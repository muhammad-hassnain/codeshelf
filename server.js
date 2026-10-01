#!/usr/bin/env node
/*
 * CodeShelf — a local dashboard for your Claude Code sessions.
 *
 * Reads (never writes) the files Claude Code keeps under ~/.claude:
 *   - ~/.claude/sessions/<pid>.json          -> live process registry (busy/idle)
 *   - ~/.claude/projects/<proj>/<uuid>.jsonl -> full conversation transcripts
 *
 * The ONLY thing it ever writes is a reply you explicitly confirm, which it
 * sends by running `claude --resume <id> -p [--model m] -- "<message>"`. For a
 * session that's live in the app this resumes a separate continuation (the CLI
 * won't let two processes share one transcript), so the UI says so first.
 *
 * Security model (this is a local server exposing sensitive data + a
 * code-executing endpoint, so it is defended against malicious web pages):
 *   - binds loopback only by default
 *   - Host-header allowlist           -> blocks DNS-rebinding
 *   - per-start token on every /api   -> blocks blind cross-origin requests
 *   - Origin / Sec-Fetch + JSON CT    -> blocks CSRF on the send endpoint
 *   - argument-safe spawn (`--`)      -> blocks CLI argument injection
 *   - server-derived cwd, UUID check  -> no attacker-chosen exec directory
 *
 * No external dependencies. Run:  node server.js
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOME = os.homedir();
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude");
const SESSIONS_DIR = path.join(CLAUDE_DIR, "sessions");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const PUBLIC_DIR = path.join(__dirname, "public");

const PORT = Number(process.env.PORT || 4178);
const HOST = process.env.HOST || "127.0.0.1";

// A fresh secret each start. The SPA receives it embedded in index.html; a
// cross-origin page can neither read that HTML nor guess the token.
const TOKEN = crypto.randomBytes(24).toString("hex");

const LIVE_STALE_MS = 24 * 60 * 60 * 1000; // ignore registry entries older than this
const LIST_TTL_MS = 2500; // serve the built session list from cache this long
const SEND_TIMEOUT_MS = 8 * 60 * 1000;
const MAX_CONCURRENT_SENDS = 3;
const MAX_SEND_OUTPUT = 2 * 1024 * 1024;
const MAX_BODY = 64 * 1024;
const CONVO_LIMIT_MAX = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Claude desktop app's data dir (holds plan-usage-history.json) — resolved
// per OS: macOS ~/Library/Application Support/Claude, Windows %APPDATA%\Claude,
// Linux ~/.config/Claude. Override with CE_USAGE_FILE if yours differs.
function claudeDesktopDir() {
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Claude");
  if (process.platform === "darwin") return path.join(HOME, "Library", "Application Support", "Claude");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "Claude");
}
const USAGE_FILE = process.env.CE_USAGE_FILE || path.join(claudeDesktopDir(), "plan-usage-history.json");
// Attachments the user posts from the web app land here (outside ~/.claude).
const UPLOADS_DIR = path.join(HOME, ".codeshelf", "uploads");
const MAX_UPLOAD = 10 * 1024 * 1024;
// Your claude.ai org slug — used to build "open the live session" deep links
// (claude://claude.ai/<org>/<hostSessionId>). Set CE_ORG to your org slug to enable
// the "open in app" links and live-window typing; left blank, those simply don't appear.
const CLAUDE_ORG = process.env.CE_ORG || "";
const RC_URL = "https://claude.ai/code";
// Models / effort levels the reply endpoint may pass (validated server-side).
const ALLOWED_MODELS = new Set(["opus", "sonnet", "haiku", "fable"]);
const ALLOWED_EFFORT = new Set(["low", "medium", "high", "xhigh", "max"]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function prettyCwd(cwd) {
  if (!cwd) return "unknown";
  if (cwd.includes("/scratch-workspaces/")) return "scratch";
  return cwd.split("/").filter(Boolean).pop() || cwd;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const b of content) {
    if (b && typeof b === "object" && b.type === "text" && typeof b.text === "string") parts.push(b.text);
  }
  return parts.join("\n");
}

// Strip injected machine framing (system reminders, task notifications, etc.)
// so previews show the human's words, not harness scaffolding.
function cleanPreviewText(s) {
  if (!s) return "";
  return s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function preview(s, n = 160) {
  if (!s) return "";
  const t = cleanPreviewText(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// ---------------------------------------------------------------------------
// Transcript metadata (cached by file mtime)
// ---------------------------------------------------------------------------

const metaCache = new Map();

async function parseTranscriptMeta(file) {
  const meta = {
    sessionId: path.basename(file, ".jsonl"),
    file,
    cwd: null,
    gitBranch: null,
    customTitle: null,
    aiTitle: null,
    firstPrompt: null,
    lastUserText: null,
    lastAssistantText: null,
    lastRole: null,
    lastTs: null,
    firstTs: null,
    model: null,
    messageCount: 0,
    userCount: 0,
    assistantCount: 0,
    lastAssistantEndsWithQuestion: false,
    pendingTool: null,
    tok5h: 0,
    tokWeek: 0,
  };
  const now = Date.now();

  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const t = o.type;
      if (t === "custom-title") {
        if (typeof o.customTitle === "string") meta.customTitle = o.customTitle;
        continue;
      }
      if (t === "ai-title") {
        if (typeof o.aiTitle === "string") meta.aiTitle = o.aiTitle;
        continue;
      }
      if (t !== "user" && t !== "assistant") continue;
      if (o.isMeta || o.isSidechain) continue;

      const msg = o.message;
      if (!msg || typeof msg !== "object") continue;

      if (o.cwd) meta.cwd = o.cwd;
      if (o.gitBranch) meta.gitBranch = o.gitBranch;
      if (o.timestamp) {
        meta.lastTs = o.timestamp;
        if (!meta.firstTs) meta.firstTs = o.timestamp;
      }

      const text = extractText(msg.content);

      if (t === "user") {
        const isToolResultOnly =
          Array.isArray(msg.content) && msg.content.length > 0 &&
          msg.content.every((b) => b && b.type === "tool_result");
        if (!isToolResultOnly) {
          meta.messageCount++;
          meta.userCount++;
          meta.lastRole = "user";
          meta.lastAssistantEndsWithQuestion = false; // a human reply clears the "waiting" flag
          meta.pendingTool = null;
          if (text.trim()) {
            meta.lastUserText = text;
            if (!meta.firstPrompt) meta.firstPrompt = text;
          }
        }
      } else if (t === "assistant") {
        if (msg.model) meta.model = msg.model;
        const u = msg.usage;
        if (u && o.timestamp) {
          const ts = Date.parse(o.timestamp);
          // New tokens only — cache *reads* are cheap reuse, so excluded.
          const tot = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
          if (ts) {
            if (now - ts <= 5 * 3600e3) meta.tok5h += tot;
            if (now - ts <= 7 * 86400e3) meta.tokWeek += tot;
          }
        }
        const blocks = Array.isArray(msg.content) ? msg.content : [];
        const hasText = blocks.some((b) => b && b.type === "text" && b.text && b.text.trim());
        const toolUses = blocks.filter((b) => b && b.type === "tool_use");
        if (hasText) {
          meta.messageCount++;
          meta.assistantCount++;
          meta.lastRole = "assistant";
          meta.lastAssistantText = text;
          meta.lastAssistantEndsWithQuestion = /\?\s*$/.test(text.trim());
          meta.pendingTool = null;
        } else if (toolUses.length) {
          meta.pendingTool = toolUses[toolUses.length - 1].name || "tool";
        }
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  meta.title =
    meta.customTitle ||
    meta.aiTitle ||
    (meta.firstPrompt ? preview(meta.firstPrompt, 60) : null) ||
    "Untitled session";
  return meta;
}

async function getMeta(file) {
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    metaCache.delete(file);
    return null;
  }
  const cached = metaCache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.meta;
  const meta = await parseTranscriptMeta(file);
  meta.sizeBytes = stat.size;
  meta.mtimeMs = stat.mtimeMs;
  metaCache.set(file, { mtimeMs: stat.mtimeMs, meta });
  return meta;
}

async function listTranscriptFiles() {
  let projDirs;
  try {
    projDirs = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const d of projDirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(PROJECTS_DIR, d.name);
    let entries;
    try {
      entries = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.endsWith(".jsonl")) files.push(path.join(dir, name));
    }
  }
  return files;
}

async function readLiveRegistry() {
  const live = new Map();
  let entries;
  try {
    entries = await fsp.readdir(SESSIONS_DIR);
  } catch {
    return live;
  }
  const now = Date.now();
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fsp.readFile(path.join(SESSIONS_DIR, name), "utf8");
      const d = JSON.parse(raw);
      if (!d.sessionId) continue;
      if (!pidAlive(d.pid)) continue; // process gone -> closed
      // Guard against pid reuse: a stale registration whose pid now belongs to
      // some unrelated process. Claude itself ignores peers older than 24h.
      const updated = d.updatedAt || d.statusUpdatedAt || d.startedAt || 0;
      if (updated && now - updated > LIVE_STALE_MS) continue;
      live.set(d.sessionId, {
        pid: d.pid,
        status: d.status || "unknown",
        name: d.name || null,
        cwd: d.cwd || null,
        startedAt: d.startedAt || null,
        updatedAt: updated || null,
        kind: d.kind || null,
        version: d.version || null,
        hostSessionId: d.hostSessionId || null,
      });
    } catch {
      /* ignore malformed */
    }
  }
  return live;
}

function deriveStatus(live) {
  if (!live) return "closed";
  if (live.status === "busy") return "working";
  if (live.status === "idle") return "waiting";
  return "running";
}

let listBuilding = null;
let listCache = { at: 0, data: null };

async function buildSessionList() {
  const [files, live] = await Promise.all([listTranscriptFiles(), readLiveRegistry()]);

  // Evict cache entries for transcripts that no longer exist.
  const fileSet = new Set(files);
  for (const key of metaCache.keys()) if (!fileSet.has(key)) metaCache.delete(key);

  const CONCURRENCY = 8;
  const out = [];
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const file = files[i++];
      const meta = await getMeta(file).catch(() => null);
      if (!meta || meta.messageCount === 0) continue;
      const lv = live.get(meta.sessionId);
      const status = deriveStatus(lv);
      out.push({
        sessionId: meta.sessionId,
        title: lv?.name || meta.title,
        project: prettyCwd(meta.cwd || lv?.cwd),
        cwd: meta.cwd || lv?.cwd || null,
        gitBranch: meta.gitBranch,
        status,
        live: !!lv,
        appLink: CLAUDE_ORG && lv?.hostSessionId ? `claude://claude.ai/${CLAUDE_ORG}/${lv.hostSessionId}` : null,
        model: meta.model,
        messageCount: meta.messageCount,
        userCount: meta.userCount,
        assistantCount: meta.assistantCount,
        lastRole: meta.lastRole,
        lastTs: meta.lastTs,
        firstTs: meta.firstTs,
        mtimeMs: meta.mtimeMs,
        pendingTool: meta.pendingTool,
        tok5h: meta.tok5h,
        tokWeek: meta.tokWeek,
        needsAttention: status === "waiting",
        lastMessage: preview(
          meta.lastRole === "assistant" ? meta.lastAssistantText : meta.lastUserText,
          200
        ),
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return out;
}

async function getSessionList() {
  if (listCache.data && Date.now() - listCache.at < LIST_TTL_MS) return listCache.data;
  if (!listBuilding) {
    listBuilding = buildSessionList()
      .then((data) => {
        listCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        listBuilding = null;
      });
  }
  return listBuilding;
}

// ---------------------------------------------------------------------------
// Full conversation for one session
// ---------------------------------------------------------------------------

function summarizeToolInput(input) {
  if (!input || typeof input !== "object") return "";
  const keys = ["command", "file_path", "path", "pattern", "query", "url", "prompt", "description"];
  for (const k of keys) {
    if (typeof input[k] === "string" && input[k].trim()) return preview(input[k], 140);
  }
  try {
    return preview(JSON.stringify(input), 140);
  } catch {
    return "";
  }
}

async function findTranscriptFile(sessionId) {
  if (!UUID_RE.test(sessionId)) return null;
  const files = await listTranscriptFiles();
  return files.find((f) => path.basename(f, ".jsonl") === sessionId) || null;
}

async function readConversation(sessionId, { limit = 1200 } = {}) {
  limit = Math.max(1, Math.min(CONVO_LIMIT_MAX, Number(limit) || 1200));
  const file = await findTranscriptFile(sessionId);
  if (!file) return null;

  const tail = []; // bounded ring buffer of the last `limit` messages
  let total = 0;
  const meta = { sessionId, cwd: null, customTitle: null, aiTitle: null, firstPrompt: null };

  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o.type === "custom-title" && o.customTitle) meta.customTitle = o.customTitle;
      if (o.type === "ai-title" && o.aiTitle) meta.aiTitle = o.aiTitle;
      if (o.type !== "user" && o.type !== "assistant") continue;
      if (o.isMeta || o.isSidechain) continue;
      const msg = o.message;
      if (!msg || typeof msg !== "object") continue;
      if (o.cwd) meta.cwd = o.cwd;

      const blocks = [];
      const content = msg.content;
      if (typeof content === "string") {
        if (content.trim()) blocks.push({ type: "text", text: content });
      } else if (Array.isArray(content)) {
        for (const b of content) {
          if (!b || typeof b !== "object") continue;
          if (b.type === "text" && b.text) blocks.push({ type: "text", text: b.text });
          else if (b.type === "thinking" && b.thinking) blocks.push({ type: "thinking", text: b.thinking });
          else if (b.type === "tool_use")
            blocks.push({ type: "tool_use", name: b.name, summary: summarizeToolInput(b.input) });
          else if (b.type === "tool_result") {
            const txt = extractText(b.content) || (typeof b.content === "string" ? b.content : "");
            blocks.push({ type: "tool_result", text: preview(txt, 400), isError: !!b.is_error });
          } else if (b.type === "image") blocks.push({ type: "image" });
        }
      }
      if (!blocks.length) continue;

      if (!meta.firstPrompt && o.type === "user") {
        const txt = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        if (txt.trim()) meta.firstPrompt = txt;
      }

      const onlyToolResults = o.type === "user" && blocks.every((b) => b.type === "tool_result");
      // A genuinely human-typed prompt (not a task-notification or injected turn).
      const human = o.type === "user" && o.origin && o.origin.kind === "human";
      total++;
      tail.push({ uuid: o.uuid, role: o.type, ts: o.timestamp || null, model: msg.model || null, onlyToolResults, human, blocks });
      if (tail.length > limit) tail.shift();
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  meta.title =
    meta.customTitle || meta.aiTitle || (meta.firstPrompt ? preview(meta.firstPrompt, 60) : "Untitled session");

  const live = (await readLiveRegistry()).get(sessionId);
  return {
    sessionId,
    title: live?.name || meta.title,
    project: prettyCwd(meta.cwd || live?.cwd),
    status: deriveStatus(live),
    live: !!live,
    appLink: CLAUDE_ORG && live?.hostSessionId ? `claude://claude.ai/${CLAUDE_ORG}/${live.hostSessionId}` : null,
    totalMessages: total,
    returnedMessages: tail.length,
    truncated: total > tail.length,
    lastTs: tail.length ? tail[tail.length - 1].ts : null,
    messages: tail,
  };
}

// ---------------------------------------------------------------------------
// Search across all transcripts
// ---------------------------------------------------------------------------

function makeSnippet(text, term) {
  const clean = cleanPreviewText(text);
  const i = clean.toLowerCase().indexOf(term);
  if (i < 0) return preview(clean, 160);
  const start = Math.max(0, i - 60);
  const end = Math.min(clean.length, i + term.length + 100);
  return (
    (start > 0 ? "…" : "") +
    clean.slice(start, end).replace(/\s+/g, " ").trim() +
    (end < clean.length ? "…" : "")
  );
}

async function scanFileForSnippet(file, terms) {
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const seen = new Set();
  let bestSnippet = "";
  let bestHits = 0;
  try {
    for await (const line of rl) {
      const low = line.toLowerCase();
      // Count any term seen anywhere on the line (covers thinking/tool content).
      let lineHasNew = false;
      for (const t of terms) if (low.includes(t) && !seen.has(t)) { seen.add(t); lineHasNew = true; }
      if (!low.includes(terms[0]) && !lineHasNew) continue;
      try {
        const o = JSON.parse(line);
        if (o.type !== "user" && o.type !== "assistant") continue;
        const text = extractText(o.message?.content);
        if (!text) continue;
        const textLow = text.toLowerCase();
        const textHits = terms.filter((t) => textLow.includes(t));
        if (textHits.length > bestHits) {
          bestHits = textHits.length;
          bestSnippet = makeSnippet(text, textHits[0] || terms[0]);
        }
      } catch {
        /* ignore */
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return terms.every((t) => seen.has(t)) ? bestSnippet || "(match in tool output)" : "";
}

async function searchAll(query, { maxResults = 80 } = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!terms.length) return [];
  const [files, live] = await Promise.all([listTranscriptFiles(), readLiveRegistry()]);

  const CONCURRENCY = 8;
  const results = [];
  let i = 0;
  async function worker() {
    while (i < files.length) {
      const file = files[i++];
      const meta = await getMeta(file).catch(() => null);
      if (!meta) continue;
      const hay = [meta.title, meta.firstPrompt, meta.lastUserText, meta.lastAssistantText]
        .filter(Boolean)
        .join("\n");
      const hayLower = hay.toLowerCase();
      let snippet = "";
      if (terms.every((t) => hayLower.includes(t))) {
        snippet = makeSnippet(hay, terms[0]);
      } else {
        snippet = await scanFileForSnippet(file, terms);
      }
      if (!snippet) continue;
      const lv = live.get(meta.sessionId);
      results.push({
        sessionId: meta.sessionId,
        title: lv?.name || meta.title,
        project: prettyCwd(meta.cwd || lv?.cwd),
        status: deriveStatus(lv),
        lastTs: meta.lastTs,
        mtimeMs: meta.mtimeMs,
        snippet,
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return results.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Plan usage (read from the desktop app's local history file)
// ---------------------------------------------------------------------------

async function readUsage() {
  let raw;
  try {
    raw = await fsp.readFile(USAGE_FILE, "utf8");
  } catch {
    return { available: false };
  }
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return { available: false };
  }
  const samples = (Array.isArray(d.samples) ? d.samples : []).filter((s) => s && s.t && s.u);
  if (!samples.length) return { available: false };

  const now = Date.now();
  const within = (ms) => samples.filter((s) => s.t >= now - ms);
  const downsample = (arr, key, n = 64) => {
    const pts = arr.map((s) => ({ t: s.t, v: Number(s.u[key]) || 0 }));
    if (pts.length <= n) return pts;
    const step = pts.length / n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * step)]);
    out.push(pts[pts.length - 1]);
    return out;
  };
  const last = samples[samples.length - 1];
  return {
    available: true,
    updatedAt: last.t,
    fiveHour: { current: Number(last.u.fh) || 0, series: downsample(within(24 * 3600e3), "fh") },
    weekly: { current: Number(last.u.sd) || 0, series: downsample(within(7 * 24 * 3600e3), "sd") },
  };
}

// ---------------------------------------------------------------------------
// Sending a message
// ---------------------------------------------------------------------------

function findClaudeBinary() {
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const win = process.platform === "win32";
  const exe = win ? "claude.exe" : "claude";
  const candidates = [path.join(HOME, ".claude", "local", exe)];
  let bundleGlob = null;
  if (win) {
    const appdata = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
    const localapp = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
    candidates.push(
      path.join(appdata, "npm", "claude.exe"),
      path.join(localapp, "Programs", "claude", "claude.exe"),
    );
    bundleGlob = path.join(appdata, "Claude", "claude-code", "*", "*", "claude.exe");
  } else if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/claude", "/usr/local/bin/claude", path.join(HOME, ".local", "bin", "claude"));
    bundleGlob = path.join(HOME, "Library/Application Support/Claude/claude-code/*/claude.app/Contents/MacOS/claude");
  } else {
    candidates.push("/usr/local/bin/claude", "/usr/bin/claude", path.join(HOME, ".local", "bin", "claude"));
    bundleGlob = path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "Claude", "claude-code", "*", "*", "claude");
  }
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch {} }
  // Fall back to the Claude desktop app's bundled CLI (newest version).
  try {
    if (bundleGlob) { const b = fs.globSync(bundleGlob).sort(); if (b.length) return b[b.length - 1]; }
  } catch {
    /* globSync may be unavailable on very old Node */
  }
  return win ? "claude.exe" : "claude"; // last resort: rely on PATH
}

function loginCommand() {
  const bin = findClaudeBinary();
  return /\s/.test(bin) ? `"${bin}" auth login` : `${bin} auth login`;
}


// Whether the standalone `claude` CLI is logged in (replies shell out to it, and
// the desktop app's keychain login doesn't cover command-line runs). Cached.
let authCache = { at: 0, loggedIn: false, checked: false };
async function checkLoggedIn() {
  if (authCache.checked && Date.now() - authCache.at < 30000) return authCache.loggedIn;
  const bin = findClaudeBinary();
  const loggedIn = await new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const c = spawn(bin, ["auth", "status"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
      let out = "";
      const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch {} fin(false); }, 8000);
      t.unref?.();
      c.stdout.setEncoding("utf8");
      c.stdout.on("data", (d) => (out += d));
      c.on("error", () => { clearTimeout(t); fin(false); });
      c.on("close", () => {
        clearTimeout(t);
        try { fin(!!JSON.parse(out).loggedIn); }
        catch { fin(/logged in/i.test(out) && !/not logged in/i.test(out)); }
      });
    } catch { fin(false); }
  });
  authCache = { at: Date.now(), loggedIn, checked: true };
  return loggedIn;
}

const AUTH_RE = /not logged in|\/login|setup-token|auth|sign ?in|credential|invalid api key|unauthor/i;

const inFlightSends = new Set();
const inFlightTypes = new Set(); // sessions with an in-progress live-window paste

async function sendToSession(sessionId, message, model, effort, attachments) {
  if (!UUID_RE.test(sessionId)) return { ok: false, reason: "badid", message: "Invalid session id." };
  if (model && !ALLOWED_MODELS.has(model)) return { ok: false, reason: "badmodel", message: "Unknown model." };
  if (effort && !ALLOWED_EFFORT.has(effort)) return { ok: false, reason: "badeffort", message: "Unknown effort level." };
  const files = (Array.isArray(attachments) ? attachments : []).map(resolveUpload).filter(Boolean).slice(0, 10);

  const file = await findTranscriptFile(sessionId);
  if (!file) return { ok: false, reason: "notfound", message: "No such session." };

  const live = await readLiveRegistry();
  const wasLive = live.has(sessionId);

  // The working directory is derived from the transcript — never from the
  // request — so a caller can't choose where the agent runs.
  const meta = await getMeta(file).catch(() => null);
  const cwd = meta?.cwd;
  if (!cwd || !fs.existsSync(cwd)) {
    return {
      ok: false,
      reason: "nocwd",
      message: cwd
        ? `The session's working directory no longer exists:\n${cwd}`
        : "Could not determine the session's working directory.",
    };
  }

  if (inFlightSends.has(sessionId))
    return { ok: false, reason: "inflight", message: "A reply is already running for this session." };
  if (inFlightSends.size >= MAX_CONCURRENT_SENDS)
    return { ok: false, reason: "busy", message: "Too many replies in progress — try again in a moment." };

  inFlightSends.add(sessionId);
  // Attached files live in the uploads dir; grant the agent read access to it
  // and point the message at them so Claude reads them.
  let text = message;
  if (files.length) {
    text += `\n\nAttached file${files.length > 1 ? "s" : ""} (please read ${files.length > 1 ? "them" : "it"}):\n` + files.join("\n");
  }
  const bin = findClaudeBinary();
  // `-p` = print mode; `--model` (optional, allowlisted) picks the model;
  // `--` terminates option parsing so a message starting with `-` can never be
  // read as a CLI flag (argument injection).
  const args = ["--resume", sessionId];
  if (files.length) args.push("--add-dir", UPLOADS_DIR);
  args.push("-p");
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  args.push("--", text);
  try {
    return await new Promise((resolve) => {
      const child = spawn(bin, args, {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"], // no stdin -> child never blocks waiting for EOF
      });
      let out = "";
      let err = "";
      let killed = false;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (d) => { if (out.length < MAX_SEND_OUTPUT) out += d; });
      child.stderr.on("data", (d) => { if (err.length < MAX_SEND_OUTPUT) err += d; });
      const killer = setTimeout(() => {
        killed = true;
        child.kill("SIGTERM");
        setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 5000).unref();
      }, SEND_TIMEOUT_MS);
      child.on("error", (e) => {
        clearTimeout(killer);
        resolve({
          ok: false,
          reason: "spawn",
          message:
            e.code === "ENOENT"
              ? "Couldn't find the `claude` command. Set CLAUDE_BIN to its full path."
              : "Could not launch Claude Code.",
        });
      });
      child.on("close", (code) => {
        clearTimeout(killer);
        if (killed) return resolve({ ok: false, reason: "timeout", message: "The reply timed out." });
        if (code === 0) return resolve({ ok: true, reply: out.trim(), wasLive });
        const detail = (err || out || `Claude exited with code ${code}`).trim();
        if (AUTH_RE.test(detail)) {
          authCache = { at: Date.now(), loggedIn: false, checked: true };
          return resolve({
            ok: false,
            reason: "auth",
            message: "The `claude` command isn't logged in, so replies can't run. In a terminal, run this once, then try again:",
            loginCmd: loginCommand(),
          });
        }
        resolve({ ok: false, reason: "exit", message: detail.slice(0, 2000) });
      });
    });
  } finally {
    inFlightSends.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Live-window typing (macOS "bot"): put the message on the clipboard, focus the
// session via its deep link, then drive the Claude app with AppleScript
// (⌘V, Return) so the text is typed straight into the real live window — which
// means it also syncs to Remote Control / phone, unlike a headless `-p` reply.
// Needs macOS Accessibility permission for whatever app launched this server.
// ---------------------------------------------------------------------------
const HOST_SESSION_RE = /^[A-Za-z0-9._-]{1,200}$/;
const LIVE_FOCUS_MS = 1200; // let the app bring the session to the front before pasting
const A11Y_RE = /assistive access|not allowed to send|accessibility|-25211|-1719|not permitted/i;

// Run a short command, optionally feeding `input` to stdin. Resolves
// {code,out,err,truncated}; `truncated` is set if stdout exceeded `maxBuf`.
function runProc(cmd, args, { input, timeoutMs = 20000, maxBuf = 8192 } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(cmd, args, { stdio: [input != null ? "pipe" : "ignore", "pipe", "pipe"] }); }
    catch (e) { return resolve({ code: -1, out: "", err: String(e.message || e), truncated: false }); }
    let out = "", err = "", done = false, truncated = false;
    const finish = (code) => { if (done) return; done = true; clearTimeout(t); resolve({ code, out, err, truncated }); };
    const t = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} finish(-1); }, timeoutMs);
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => { if (out.length < maxBuf) out += d; else truncated = true; });
    child.stderr.on("data", (d) => { if (err.length < 8192) err += d; });
    child.on("error", (e) => { err += String(e.message || e); finish(-1); });
    child.on("close", (code) => finish(code));
    if (input != null) { child.stdin.on("error", () => {}); child.stdin.end(input); }
  });
}

// Reads the name of whichever app is frontmost right now. Captured BEFORE we open
// anything, so "where the user was" is their own window — not the Claude app after
// it has already come forward (the bug that left people parked in Claude).
const FRONT_APP_SCRIPT = `tell application "System Events" to return name of first application process whose frontmost is true`;

// Front Claude only for the instant it takes to paste+send, then hand focus back to
// `prevApp` (passed in as an argument). Keystrokes can only reach the frontmost app,
// so a brief front is unavoidable — this keeps it to ~0.3s and always restores focus,
// including on the NOTFRONT bail-out.
const PASTE_SCRIPT = `on run argv
  set prevApp to item 1 of argv
  tell application "System Events"
    -- Prefer the main UI process (named exactly "Claude") over background helpers
    -- like "Claude Helper (GPU)", which have no window to bring forward.
    set claudeProcs to (every application process whose name is "Claude")
    if claudeProcs is {} then set claudeProcs to (every application process whose name contains "Claude" and background only is false)
    if claudeProcs is {} then return "NOCLAUDE"
    set frontmost of item 1 of claudeProcs to true
  end tell
  -- Wait until Claude is ACTUALLY frontmost (poll up to ~1.6s) instead of a fixed
  -- guess, so the paste never lands early in the wrong app on a slow machine.
  set waited to 0
  repeat
    delay 0.1
    set waited to waited + 1
    tell application "System Events" to set fg to name of first application process whose frontmost is true
    if fg contains "Claude" then exit repeat
    if waited > 15 then
      my restoreFocus(prevApp)
      return "NOTFRONT"
    end if
  end repeat
  tell application "System Events"
    keystroke "v" using command down
    delay 0.1
    key code 36
  end tell
  delay 0.08
  my restoreFocus(prevApp)
  return "OK"
end run

on restoreFocus(prevApp)
  if prevApp is missing value or prevApp is "" then return
  if prevApp contains "Claude" then return
  try
    tell application "System Events" to set frontmost of (first application process whose name is prevApp) to true
  end try
end restoreFocus`;

async function typeIntoLiveWindow(sessionId, message) {
  if (process.platform !== "darwin")
    return { ok: false, reason: "platform", message: "Typing into the live window is only supported on macOS." };
  if (!UUID_RE.test(sessionId)) return { ok: false, reason: "badid", message: "Invalid session id." };
  if (!CLAUDE_ORG)
    return { ok: false, reason: "noorg", message: "Set the CE_ORG environment variable to your claude.ai org slug to enable live-window typing." };

  const live = (await readLiveRegistry()).get(sessionId);
  if (!live) return { ok: false, reason: "notlive", message: "This session isn't live anymore — reopen it, or send a separate turn here." };
  const host = live.hostSessionId;
  if (!host || !HOST_SESSION_RE.test(host))
    return { ok: false, reason: "nolink", message: "No app link for this session, so it can't be typed into the live window. Use ‘send a separate turn here’ instead." };

  // One paste at a time per session — overlapping automations would double-open and
  // fight over the frontmost app.
  if (inFlightTypes.has(sessionId))
    return { ok: false, reason: "inflight", message: "Still delivering your last message to the live window — one moment." };
  inFlightTypes.add(sessionId);
  try {
    return await typeIntoLiveWindowInner(host, message);
  } finally {
    inFlightTypes.delete(sessionId);
  }
}

async function typeIntoLiveWindowInner(host, message) {
  const deepLink = `claude://claude.ai/${CLAUDE_ORG}/${host}`;

  // 0. Remember where the user currently is, BEFORE anything can steal focus, so we
  //    can hand it straight back after typing. (Falls back to "" = don't restore.)
  const pre = await runProc("/usr/bin/osascript", ["-e", FRONT_APP_SCRIPT]);
  if (pre.code !== 0 && A11Y_RE.test(pre.err))
    return { ok: false, reason: "accessibility", message: "macOS blocked the automation — Accessibility permission is needed." };
  const prevApp = pre.code === 0 ? pre.out.trim() : "";

  // Save the user's current (text) clipboard so we can put it back afterwards —
  // the paste clobbers it otherwise. Non-text clipboards (e.g. an image) come back
  // empty from pbpaste; in that case we leave the message on the clipboard. We read
  // with a generous cap and only restore when it wasn't truncated, so a very large
  // clipboard is never silently replaced with a truncated copy.
  const clip = await runProc("/usr/bin/pbpaste", [], { maxBuf: 4 * 1024 * 1024 });
  const savedClip = clip.code === 0 && !clip.truncated ? clip.out : "";

  // 1. Put the message on the clipboard (stdin → pbcopy; no shell, no escaping).
  const cp = await runProc("/usr/bin/pbcopy", [], { input: message });
  if (cp.code !== 0) return { ok: false, reason: "clipboard", message: "Couldn't set the clipboard." };

  // 2. Select the right live session in the BACKGROUND (-g = don't bring the app
  //    to the front), so switching sessions never steals the user's focus.
  const op = await runProc("/usr/bin/open", ["-g", deepLink]);
  if (op.code !== 0) {
    if (savedClip) await runProc("/usr/bin/pbcopy", [], { input: savedClip });
    return { ok: false, reason: "open", message: "Couldn't open the live session in the Claude app. Is the app installed?" };
  }

  // 3. Let the app load/focus that session + its composer while still backgrounded
  //    (invisible to the user), THEN flash to the front just long enough to paste,
  //    and restore focus to `prevApp`.
  await new Promise((r) => setTimeout(r, LIVE_FOCUS_MS));
  const os = await runProc("/usr/bin/osascript", ["-e", PASTE_SCRIPT, prevApp]);
  // Restore the clipboard now that the paste has happened (best-effort).
  if (savedClip) await runProc("/usr/bin/pbcopy", [], { input: savedClip });
  if (os.code !== 0) {
    if (A11Y_RE.test(os.err))
      return { ok: false, reason: "accessibility", message: "macOS blocked the keystrokes — Accessibility permission is needed." };
    return { ok: false, reason: "osascript", message: (os.err.trim() || "Couldn't type into the live window.").slice(0, 500) };
  }
  if (os.out.includes("NOCLAUDE"))
    return { ok: false, reason: "noapp", message: "The Claude app doesn't seem to be running. Open it, then try again." };
  if (os.out.includes("NOTFRONT"))
    return { ok: false, reason: "notfront", message: "Couldn't focus the Claude window to type into it. Try again, or use ‘send a separate turn here’." };
  return { ok: true };
}

// Build a short context seed from an existing session, for "move context".
async function buildSeed(sessionId) {
  const file = await findTranscriptFile(sessionId);
  if (!file) return null;
  const meta = await getMeta(file).catch(() => null);
  if (!meta) return null;
  const goal = (meta.firstPrompt || "").slice(0, 1500).trim();
  const latest = (meta.lastAssistantText || "").slice(0, 1500).trim();
  let s = `Context handed off from an earlier Claude Code session ("${meta.title}", project ${prettyCwd(meta.cwd)}).`;
  if (goal) s += `\n\nOriginal request:\n${goal}`;
  if (latest) s += `\n\nWhere it left off:\n${latest}`;
  return s;
}

// Resolve a path and confirm it's an existing directory inside the user's home
// tree (so a session can't be started in a system dir like / or /etc).
function resolveSafeDir(p) {
  if (!p || typeof p !== "string") return null;
  let resolved;
  try { resolved = fs.realpathSync(path.resolve(p)); } catch { return null; }
  if (resolved !== HOME && !resolved.startsWith(HOME + path.sep)) return null;
  try { if (!fs.statSync(resolved).isDirectory()) return null; } catch { return null; }
  return resolved;
}

async function startSession({ cwd, message, model, effort, seedFrom }) {
  if (model && !ALLOWED_MODELS.has(model)) return { ok: false, message: "Unknown model." };
  if (effort && !ALLOWED_EFFORT.has(effort)) return { ok: false, message: "Unknown effort level." };
  const safe = resolveSafeDir(cwd);
  if (!safe) return { ok: false, message: "Pick a folder inside your home directory." };
  cwd = safe;

  let text = (message || "").trim();
  if (seedFrom) {
    const seed = await buildSeed(seedFrom);
    if (seed) text = seed + (text ? `\n\n---\n\n${text}` : "");
  }
  if (!text) return { ok: false, message: "Add a first message." };

  const bin = findClaudeBinary();
  const args = ["--bg"];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", effort);
  args.push("--", text);
  return await new Promise((resolve) => {
    let out = "", err = "", done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    let child;
    try { child = spawn(bin, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] }); }
    catch { return fin({ ok: false, message: "Could not launch Claude Code." }); }
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => { if (out.length < MAX_SEND_OUTPUT) out += d; }); child.stderr.on("data", (d) => { if (err.length < MAX_SEND_OUTPUT) err += d; });
    const t = setTimeout(() => { try { child.kill("SIGTERM"); } catch {} fin({ ok: false, message: "Starting the session timed out." }); }, 45000);
    child.on("error", (e) => { clearTimeout(t); fin({ ok: false, message: e.code === "ENOENT" ? "Couldn't find the claude command." : "Could not launch Claude Code." }); });
    child.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) return fin({ ok: true, id: out.trim().split(/\s+/).pop() || null });
      const detail = (err || out || `exited ${code}`).trim();
      if (AUTH_RE.test(detail)) { authCache = { at: Date.now(), loggedIn: false, checked: true }; return fin({ ok: false, reason: "auth", message: "The claude command isn't logged in. Run this once, then retry:", loginCmd: loginCommand() }); }
      fin({ ok: false, message: detail.slice(0, 600) });
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

// Hosts the browser is allowed to send (blocks DNS-rebinding).
const bindWildcard = HOST === "0.0.0.0" || HOST === "::";
const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
if (!bindWildcard) allowedHosts.add(`${HOST}:${PORT}`);
function hostAllowed(host) {
  if (bindWildcard) return true; // can't know the intended host; token is the guard
  return !!host && allowedHosts.has(host);
}
function sameSiteOk(req) {
  const sfs = req.headers["sec-fetch-site"];
  if (sfs && sfs !== "same-origin" && sfs !== "none") return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!hostAllowed(new URL(origin).host)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function baseHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  };
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { ...baseHeaders("application/json; charset=utf-8"), "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; " +
  "frame-ancestors 'none'; object-src 'none'";

async function serveStatic(res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, baseHeaders("text/plain")); res.end("forbidden"); return;
  }
  try {
    if (path.basename(filePath) === "index.html") {
      let html = await fsp.readFile(filePath, "utf8");
      html = html.replaceAll("__CE_TOKEN__", TOKEN);
      res.writeHead(200, { ...baseHeaders(MIME[".html"]), "Content-Security-Policy": CSP, "Cache-Control": "no-store" });
      res.end(html);
      return;
    }
    const data = await fsp.readFile(filePath);
    const ct = MIME[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { ...baseHeaders(ct), "Content-Security-Policy": CSP });
    res.end(data);
  } catch {
    res.writeHead(404, baseHeaders("text/plain")); res.end("not found");
  }
}

async function readBody(req, max = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw new Error("body too large");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Confirm a path is a real file inside the uploads dir (for attachment safety).
function resolveUpload(p) {
  if (!p || typeof p !== "string") return null;
  let r;
  try { r = fs.realpathSync(path.resolve(p)); } catch { return null; }
  const base = fs.realpathSync(UPLOADS_DIR);
  if (r !== base && !r.startsWith(base + path.sep)) return null;
  try { if (!fs.statSync(r).isFile()) return null; } catch { return null; }
  return r;
}

const server = http.createServer(async (req, res) => {
  // Anti-rebinding: validate Host before doing anything else.
  if (!hostAllowed(req.headers.host)) {
    res.writeHead(403, baseHeaders("text/plain"));
    res.end("forbidden host");
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch {
    res.writeHead(400, baseHeaders("text/plain")); res.end("bad request"); return;
  }
  const p = url.pathname;

  try {
    if (p.startsWith("/api/")) {
      // Token gate: a cross-origin page can't read our HTML to learn the token,
      // and a custom header forces a (blocked) CORS preflight cross-origin.
      if (req.headers["x-ce-token"] !== TOKEN) {
        return sendJSON(res, 403, { error: "forbidden" });
      }
      if (req.method !== "GET") {
        if (!sameSiteOk(req)) return sendJSON(res, 403, { error: "cross-site request refused" });
        if (!(req.headers["content-type"] || "").includes("application/json"))
          return sendJSON(res, 415, { error: "application/json required" });
      }

      if (p === "/api/sessions" && req.method === "GET") {
        const sessions = await getSessionList();
        const counts = sessions.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {});
        counts.needsAttention = sessions.filter((s) => s.needsAttention).length;
        counts.total = sessions.length;
        const usageTotals = sessions.reduce(
          (a, s) => ((a.fiveHour += s.tok5h || 0), (a.week += s.tokWeek || 0), a),
          { fiveHour: 0, week: 0 }
        );
        return sendJSON(res, 200, { sessions, counts, usageTotals, generatedAt: Date.now() });
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/send") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/send".length));
        let body;
        try {
          body = await readBody(req);
        } catch {
          return sendJSON(res, 413, { ok: false, message: "Message too large." });
        }
        const msg = typeof body.message === "string" ? body.message.trim() : "";
        if (!msg) return sendJSON(res, 400, { ok: false, message: "Empty message." });
        if (msg.length > 32000) return sendJSON(res, 413, { ok: false, message: "Message too long." });
        const model = typeof body.model === "string" && body.model ? body.model : undefined;
        const effort = typeof body.effort === "string" && body.effort ? body.effort : undefined;
        const attachments = Array.isArray(body.attachments) ? body.attachments : [];
        const result = await sendToSession(sessionId, msg, model, effort, attachments);
        // Logical failures come back as 200 so the client can render a helpful
        // message (auth guidance, etc.) rather than a thrown generic error.
        return sendJSON(res, 200, result);
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/livetype") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/livetype".length));
        let body;
        try { body = await readBody(req); } catch { return sendJSON(res, 413, { ok: false, message: "Message too large." }); }
        const msg = typeof body.message === "string" ? body.message.trim() : "";
        if (!msg) return sendJSON(res, 400, { ok: false, message: "Empty message." });
        if (msg.length > 32000) return sendJSON(res, 413, { ok: false, message: "Message too long." });
        const result = await typeIntoLiveWindow(sessionId, msg);
        return sendJSON(res, 200, result);
      }

      if (p.startsWith("/api/sessions/") && req.method === "GET") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length));
        const convo = await readConversation(sessionId, { limit: url.searchParams.get("limit") });
        if (!convo) return sendJSON(res, 404, { error: "session not found" });
        return sendJSON(res, 200, convo);
      }

      if (p === "/api/search" && req.method === "GET") {
        const results = await searchAll(url.searchParams.get("q") || "");
        return sendJSON(res, 200, { results });
      }

      if (p === "/api/usage" && req.method === "GET") {
        return sendJSON(res, 200, await readUsage());
      }

      if (p === "/api/meta" && req.method === "GET") {
        const sessions = await getSessionList();
        const folders = [...new Map(sessions.filter((s) => s.cwd).map((s) => [s.cwd, { cwd: s.cwd, project: s.project }])).values()]
          .sort((a, b) => a.project.localeCompare(b.project));
        return sendJSON(res, 200, { loggedIn: await checkLoggedIn(), loginCmd: loginCommand(), folders, rcUrl: RC_URL, platform: process.platform });
      }

      if (p === "/api/new" && req.method === "POST") {
        let body;
        try { body = await readBody(req); } catch { return sendJSON(res, 413, { ok: false, message: "Too large." }); }
        const result = await startSession({
          cwd: typeof body.cwd === "string" ? body.cwd : "",
          message: typeof body.message === "string" ? body.message : "",
          model: typeof body.model === "string" && body.model ? body.model : undefined,
          effort: typeof body.effort === "string" && body.effort ? body.effort : undefined,
          seedFrom: typeof body.seedFrom === "string" && body.seedFrom ? body.seedFrom : undefined,
        });
        return sendJSON(res, 200, result);
      }

      if (p === "/api/folders" && req.method === "GET") {
        const base = resolveSafeDir(url.searchParams.get("path") || HOME) || HOME;
        let entries = [];
        try {
          entries = fs.readdirSync(base, { withFileTypes: true })
            .filter((d) => (d.isDirectory() || d.isSymbolicLink()) && !d.name.startsWith("."))
            .map((d) => ({ name: d.name, path: path.join(base, d.name) }))
            .sort((a, b) => a.name.localeCompare(b.name));
        } catch {}
        const parent = base === HOME ? null : path.dirname(base);
        return sendJSON(res, 200, { path: base, home: HOME, parent: parent && resolveSafeDir(parent) ? parent : null, entries });
      }

      if (p === "/api/upload" && req.method === "POST") {
        let body;
        // The file arrives base64-encoded inside a JSON body, so the raw body is ~4/3
        // the decoded size; cap accordingly (plus slack) or a <10MB file is wrongly rejected.
        try { body = await readBody(req, Math.ceil(MAX_UPLOAD * 4 / 3) + 512 * 1024); } catch { return sendJSON(res, 413, { ok: false, message: "File too large (10MB max)." }); }
        const b64 = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
        if (!b64) return sendJSON(res, 400, { ok: false, message: "No file data." });
        let buf;
        try { buf = Buffer.from(b64, "base64"); } catch { return sendJSON(res, 400, { ok: false, message: "Bad file data." }); }
        if (!buf.length || buf.length > MAX_UPLOAD) return sendJSON(res, 413, { ok: false, message: "File too large (10MB max)." });
        const safeName = (String(body.name || "file").replace(/[^\w.\- ]/g, "_").slice(0, 80)) || "file";
        try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
        const dest = path.join(UPLOADS_DIR, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`);
        try { fs.writeFileSync(dest, buf); } catch { return sendJSON(res, 500, { ok: false, message: "Couldn't save the file." }); }
        return sendJSON(res, 200, { ok: true, path: dest, name: safeName, size: buf.length });
      }

      if (p === "/api/mkdir" && req.method === "POST") {
        if (!sameSiteOk(req)) return sendJSON(res, 403, { ok: false, message: "refused" });
        let body;
        try { body = await readBody(req); } catch { return sendJSON(res, 413, { ok: false, message: "Too large." }); }
        const parent = resolveSafeDir(body.parent);
        const name = String(body.name || "").trim();
        if (!parent) return sendJSON(res, 200, { ok: false, message: "Pick a valid parent folder." });
        if (!name || /[\/\\]/.test(name) || name === "." || name === ".." || name.length > 100)
          return sendJSON(res, 200, { ok: false, message: "Invalid folder name." });
        const dest = path.join(parent, name);
        if (dest !== HOME && !dest.startsWith(HOME + path.sep)) return sendJSON(res, 200, { ok: false, message: "Outside home." });
        try { fs.mkdirSync(dest, { recursive: true }); } catch (e) { return sendJSON(res, 200, { ok: false, message: "Couldn't create folder." }); }
        return sendJSON(res, 200, { ok: true, path: dest });
      }

      if (p === "/api/health") return sendJSON(res, 200, { ok: true });

      return sendJSON(res, 404, { error: "not found" });
    }

    return serveStatic(res, p);
  } catch (e) {
    console.error("request error:", e); // detail stays local
    sendJSON(res, 500, { error: "internal error" });
  }
});

// Resumed turns can run for several minutes; don't let Node's default
// request timeout sever the socket mid-reply.
server.requestTimeout = SEND_TIMEOUT_MS + 60 * 1000;
server.headersTimeout = 60 * 1000;

server.listen(PORT, HOST, () => {
  const shownHost = bindWildcard ? "127.0.0.1" : HOST;
  console.log(`\n  CodeShelf  →  http://${shownHost}:${PORT}`);
  console.log(`  reading sessions from: ${CLAUDE_DIR}`);
  if (bindWildcard) {
    console.log(`  ⚠  Bound to ${HOST} — reachable beyond this machine. The access token is required,`);
    console.log(`     but prefer the default 127.0.0.1 bind unless you understand the exposure.`);
  }
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log(`  ⚠  ${PROJECTS_DIR} not found — is this the right machine?`);
  }
  console.log(`  press Ctrl+C to stop\n`);
});
