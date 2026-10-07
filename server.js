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
import { spawn, spawnSync } from "node:child_process";
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
const CODESHELF_DIR = path.join(HOME, ".codeshelf");
const UPLOADS_DIR = path.join(CODESHELF_DIR, "uploads");
const CONFIG_FILE = path.join(CODESHELF_DIR, "config.json"); // holds the UI-set API key (0600)
const MAX_UPLOAD = 10 * 1024 * 1024;
// Deep link that makes the Claude desktop app switch to (and front) a specific live
// session — powers the "open in app" links, live-window typing, and the Stop button.
// The app's own URL handler routes `claude://code/continue?session=<id>`, validating
// <id> as the local host-session id (/^local_[A-Za-z0-9-]{1,64}$/) and navigating to
// that session. No org/login needed. (The older claude.ai/<org>/<id> shape was never
// recognized by the handler, so it never actually switched sessions.)
function sessionDeepLink(host) {
  return `claude://code/continue?session=${encodeURIComponent(host)}`;
}
// Who the Claude app/CLI is signed in as right now. Read fresh (lightly cached) from
// ~/.claude.json so switching accounts is reflected without restarting the server —
// this drives the "only show the logged-in account's chats" filter.
let _acctCache = null, _acctAt = 0;
function currentAccount() {
  const now = Date.now();
  if (_acctCache && now - _acctAt < 4000) return _acctCache;
  let acct = { email: "", org: "", accountUuid: "", name: "" };
  for (const p of [path.join(HOME, ".claude.json"), path.join(CLAUDE_DIR, ".claude.json")]) {
    try {
      const o = JSON.parse(fs.readFileSync(p, "utf8")).oauthAccount;
      if (o) { acct = { email: (o.emailAddress || "").toLowerCase(), org: o.organizationUuid || "", accountUuid: o.accountUuid || "", name: o.displayName || "" }; break; }
    } catch { /* missing/unreadable -> next */ }
  }
  _acctCache = acct; _acctAt = now;
  return acct;
}
// Does a session belong to the current account? Email is authoritative, org is the
// fallback; a session with no marker at all is "unknown" (null) — the UI's strict
// filter hides those, an explicit match (true) shows them.
function sessionMine(meta, acct) {
  if (meta.ownerEmail) return meta.ownerEmail === acct.email;
  if (meta.ownerOrg) return !!acct.org && meta.ownerOrg === acct.org;
  return null;
}
const RC_URL = "https://claude.ai/code";
// Models / effort levels the reply endpoint may pass (validated server-side).
// Accept the latest-model aliases OR a specific `claude-<family>-<version>` id (e.g.
// claude-opus-5-5, claude-opus-4-8). The pattern is argv-safe, and the CLI does the
// real "does this model exist" check — so we don't hardcode a list that goes stale.
const MODEL_ALIASES = new Set(["opus", "sonnet", "haiku", "fable", "opusplan", "default"]);
const MODEL_ID_RE = /^claude-[a-z]+-[0-9][0-9a-z-]{0,30}$/i;
function modelAllowed(m) { return MODEL_ALIASES.has(m) || MODEL_ID_RE.test(m); }
const ALLOWED_EFFORT = new Set(["low", "medium", "high", "xhigh", "max"]);
// Permission modes the web app may switch a reply into ("" / omit = leave default).
// bypassPermissions is intentionally excluded — too dangerous to toggle from a web UI.
const ALLOWED_PERMISSION_MODES = new Set(["auto", "acceptEdits", "plan"]);

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
    permissionMode: null,
    ownerEmail: null, // latest account that ran this session (from transcript markers)
    ownerOrg: null,
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
      // Account ownership markers Claude Code writes into the transcript. Latest wins —
      // a session can span accounts (log out / back in), so the final marker is current.
      if (t === "attachment" && o.attachment) {
        const at = o.attachment;
        if (at.type === "credential_org" && typeof at.organizationUuid === "string") meta.ownerOrg = at.organizationUuid;
        else if (at.type === "session_context") {
          const m = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(at.context?.userEmail || "");
          if (m) meta.ownerEmail = m[1].toLowerCase();
        }
        continue;
      }
      if (t !== "user" && t !== "assistant") continue;
      if (o.isMeta || o.isSidechain) continue;

      const msg = o.message;
      if (!msg || typeof msg !== "object") continue;

      if (o.cwd) meta.cwd = o.cwd;
      if (o.gitBranch) meta.gitBranch = o.gitBranch;
      if (t === "user" && typeof o.permissionMode === "string") meta.permissionMode = o.permissionMode;
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
      const entry = {
        pid: d.pid,
        status: d.status || "unknown",
        name: d.name || null,
        cwd: d.cwd || null,
        startedAt: d.startedAt || null,
        updatedAt: updated || null,
        kind: d.kind || null,
        version: d.version || null,
        hostSessionId: d.hostSessionId || null,
      };
      // A headless `claude --resume` (our own CLI send path) registers a second entry for
      // the SAME session, with no hostSessionId. Merge instead of overwrite, so the desktop
      // window's app link survives; busy wins so the board still shows Working.
      const prev = live.get(d.sessionId);
      if (prev) {
        entry.hostSessionId = entry.hostSessionId || prev.hostSessionId;
        entry.name = entry.name || prev.name;
        if (prev.status === "busy" || entry.status === "busy") entry.status = "busy";
        if (prev.hostSessionId && !d.hostSessionId) { entry.pid = prev.pid; entry.kind = prev.kind; }
      }
      live.set(d.sessionId, entry);
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
  const acct = currentAccount();

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
        appLink: lv?.hostSessionId ? sessionDeepLink(lv.hostSessionId) : null,
        model: meta.model,
        messageCount: meta.messageCount,
        userCount: meta.userCount,
        assistantCount: meta.assistantCount,
        lastRole: meta.lastRole,
        lastTs: meta.lastTs,
        firstTs: meta.firstTs,
        mtimeMs: meta.mtimeMs,
        pendingTool: meta.pendingTool,
        permissionMode: meta.permissionMode,
        mine: sessionMine(meta, acct), // true = current account, false = another, null = unknown
        queued: (queues.get(meta.sessionId) || []).length,
        queueStuck: (queues.get(meta.sessionId) || []).some((it) => it.status === "error"),
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
      if (o.type === "assistant" && msg.model) meta.model = msg.model; // latest assistant model = what the session is running on
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
    model: meta.model || null,
    appLink: live?.hostSessionId ? sessionDeepLink(live.hostSessionId) : null,
    totalMessages: total,
    returnedMessages: tail.length,
    truncated: total > tail.length,
    lastTs: tail.length ? tail[tail.length - 1].ts : null,
    messages: tail,
    queue: queueView(sessionId),
    bootId: SERVER_BOOT,
  };
}

// ---------------------------------------------------------------------------
// Prompt queue (per session): queued messages are sent one at a time, each
// waiting for the previous turn to finish — so you never interrupt Claude
// mid-turn. Drains server-side (keeps going if the tab closes) and is persisted to
// ~/.codeshelf so a server restart doesn't drop queued messages.
// ---------------------------------------------------------------------------
const queues = new Map(); // sessionId -> [{ id, text, model, effort, status, error }]
const draining = new Set();
let queueSeq = 0;
// Changes on every server start — the client compares it across polls to notice a
// restart (and, in the rare case persistence failed, that the queue was lost).
const SERVER_BOOT = crypto.randomBytes(6).toString("hex");
const QUEUE_FILE = path.join(CODESHELF_DIR, "queue.json");
let persistTimer = null;
// Write a file atomically (temp + rename) at 0600, so a crash mid-write can't leave
// a truncated JSON that would wipe the stored queue/API key on the next load.
function atomicWrite(file, data) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch {}
  fs.renameSync(tmp, file); // atomic on the same filesystem; preserves tmp's mode
}
// Debounced write of the whole queue map (it's small). Contains user message text,
// so it's written owner-only (0600), same as the API-key config.
function persistQueues() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      fs.mkdirSync(CODESHELF_DIR, { recursive: true });
      const obj = {};
      for (const [sid, items] of queues) if (items.length) obj[sid] = items;
      atomicWrite(QUEUE_FILE, JSON.stringify({ seq: queueSeq, queues: obj }));
    } catch { /* best effort */ }
  }, 150);
}
function loadQueues() {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Number.isFinite(data.seq)) queueSeq = data.seq;
    for (const [sid, items] of Object.entries(data.queues || {})) {
      if (!Array.isArray(items) || !items.length) continue;
      // A message that was mid-send when the server died may or may not have landed,
      // so don't silently re-send it — park it as an error for the user to decide.
      for (const it of items) if (it.status === "sending") { it.status = "error"; it.error = "Interrupted by a server restart — retry if it didn't go through."; }
      // Never let a restored id collide with a freshly-minted one (guards a legacy/
      // hand-edited file whose `seq` is missing), which findIndex-by-id relies on.
      for (const it of items) { const m = /^q(\d+)$/.exec(it.id || ""); if (m) queueSeq = Math.max(queueSeq, Number(m[1])); }
      queues.set(sid, items);
    }
    // Resume draining any session whose head is ready to go.
    for (const sid of queues.keys()) drainQueue(sid);
  } catch { /* no queue file yet */ }
}

function queueView(sessionId) {
  return (queues.get(sessionId) || []).map((it) => ({
    id: it.id, text: it.text, status: it.status || "queued", error: it.error || null,
    model: it.model || null, effort: it.effort || null, mode: it.mode || null,
  }));
}
const MAX_QUEUE_PER_SESSION = 50; // cap so a buggy/hostile local client can't grow the map/disk unbounded
function enqueuePrompt(sessionId, { text, model, effort, mode }) {
  if (!UUID_RE.test(sessionId)) return { ok: false, message: "Invalid session id." };
  const q = queues.get(sessionId) || [];
  if (q.length >= MAX_QUEUE_PER_SESSION) return { ok: false, code: 429, message: `Queue is full (max ${MAX_QUEUE_PER_SESSION}). Let some send first.` };
  q.push({ id: `q${++queueSeq}`, text, model, effort, mode, status: "queued", error: null });
  queues.set(sessionId, q);
  persistQueues();
  drainQueue(sessionId);
  return { ok: true };
}
function dequeuePrompt(sessionId, itemId) {
  const q = queues.get(sessionId);
  if (!q) return false;
  const i = q.findIndex((it) => it.id === itemId);
  if (i < 0 || q[i].status === "sending") return false; // can't cancel the in-flight one
  q.splice(i, 1);
  if (!q.length) queues.delete(sessionId);
  persistQueues();
  if (queues.get(sessionId)?.length) drainQueue(sessionId); // removing a blocking (e.g. errored) item resumes the rest
  return true;
}
// Retry a stopped (errored) item: flip it back to queued and let the drain resume.
function requeuePrompt(sessionId, itemId) {
  const q = queues.get(sessionId);
  if (!q) return false;
  const it = q.find((x) => x.id === itemId);
  if (!it || it.status !== "error") return false;
  it.status = "queued";
  it.error = null;
  persistQueues();
  drainQueue(sessionId);
  return true;
}

const QUEUE_POLL_MS = 1500; // how often to re-check the live turn while an item waits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// True only when an EXTERNAL live process is mid-turn (status "busy") for this
// session. Our own headless sends are serialized separately (awaited below +
// inFlightSends), so they don't count — this gate exists purely so a queued
// message never lands in the middle of the live window/terminal turn, which is
// the whole reason it was queued.
async function sessionIsBusy(sessionId) {
  const live = await readLiveRegistry();
  return deriveStatus(live.get(sessionId)) === "working";
}
// A session we can drive through the live-window "bot" (macOS GUI automation):
// it must still be live AND carry a host-session id for the deep link. When this
// holds we deliver queued messages — and any model switch — by typing into the
// real desktop window, so the switch lands on the desktop app (and syncs to
// Remote Control / phone) instead of spinning up a separate headless CLI turn.
async function botEligible(sessionId) {
  if (process.platform !== "darwin") return false;
  const live = (await readLiveRegistry()).get(sessionId);
  return !!(live && live.hostSessionId && HOST_SESSION_RE.test(live.hostSessionId));
}
// Deliver one queued item. Prefer the live-window bot so a model switch applies
// on the desktop app itself (no CLI). Fall back to the headless CLI only when the
// bot can't carry the request: a non-macOS / non-live session, attachments (can't
// be typed), or an effort/permission-mode change (CLI-only — the bot route has no
// way to type those). A plain model+text switch is exactly what the bot handles.
async function deliverQueued(sessionId, item) {
  const botCompatible = !item.effort && !item.mode &&
    !(Array.isArray(item.attachments) && item.attachments.length);
  if (botCompatible && (await botEligible(sessionId))) {
    const res = await typeIntoLiveWindow(sessionId, item.text, item.model);
    // The bot returns as soon as the keystrokes land — not when the reply finishes
    // (unlike the headless CLI, which awaits the whole turn). Flag it so the drain
    // waits for the live turn to actually start before delivering the next item,
    // otherwise two pastes could stack into one composer.
    return { ...res, viaBot: true };
  }
  return sendToSession(sessionId, item.text, item.model, item.effort, [], item.mode);
}
// After a bot delivery, wait (briefly) for the live window to flip to "busy", so the
// next queued paste doesn't land before this turn even starts. Gives up after a few
// seconds — if it never goes busy the paste may not have started a turn, and the
// drain's own wait-until-free guard still protects the following item.
async function waitForLiveTurnStart(sessionId, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await sessionIsBusy(sessionId)) return;
    await sleep(QUEUE_POLL_MS);
  }
}
async function drainQueue(sessionId) {
  if (draining.has(sessionId)) return;
  draining.add(sessionId);
  try {
    for (;;) {
      // Strictly in order: the head is the next to go. Sent items are spliced off
      // the front, so a failed item stays at the head and BLOCKS everything behind
      // it — a later message can never jump ahead of an earlier, parked one.
      const item = (queues.get(sessionId) || [])[0];
      if (!item) break;
      if (item.status !== "queued") break; // head is errored (parked) or sending — stop
      // Hold the head until the session is free, so we honor the promise the UI makes
      // ("sends when the turn finishes") instead of colliding. "Free" means: no live
      // turn (sessionIsBusy), no manual dashboard send in flight (inFlightSends), and
      // no live-window paste in flight (inFlightTypes). Bail if the head changed.
      while ((await sessionIsBusy(sessionId)) || inFlightSends.has(sessionId) || inFlightTypes.has(sessionId)) {
        const head = (queues.get(sessionId) || [])[0];
        if (!head || head.id !== item.id || head.status !== "queued") break;
        await sleep(QUEUE_POLL_MS);
      }
      const cur = queues.get(sessionId) || [];
      const fresh = cur[0];
      if (!fresh || fresh.id !== item.id || fresh.status !== "queued") continue; // head changed; re-evaluate
      fresh.status = "sending";
      persistQueues();
      const res = await deliverQueued(sessionId, fresh);
      const q = queues.get(sessionId) || [];
      const idx = q.findIndex((it) => it.id === fresh.id);
      if (res.ok) {
        if (idx >= 0) q.splice(idx, 1);
        if (!q.length) queues.delete(sessionId);
        persistQueues();
        // Bot delivery returns before the turn completes; let the live turn start so
        // the next item's wait-until-free guard sees it busy and doesn't stack a paste.
        if (res.viaBot) await waitForLiveTurnStart(sessionId);
      } else if (res.reason === "inflight") {
        // A manual "Send now" is occupying the session. Don't fail the item over a
        // transient collision — put it back to queued, wait, and re-attempt.
        if (idx >= 0) q[idx].status = "queued";
        persistQueues();
        await sleep(QUEUE_POLL_MS);
      } else {
        if (idx >= 0) { q[idx].status = "error"; q[idx].error = res.message || "Send failed"; }
        persistQueues();
        break; // stop; the failed head blocks the rest until retry or remove
      }
    }
  } finally {
    draining.delete(sessionId);
  }
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

// The "5-hour limit" and weekly numbers come LIVE from `claude -p /usage` — a local
// command (no model call, no tokens) that reports the account the CLI is logged into,
// the same figures the desktop app's usage card shows. The desktop app's own
// plan-usage-history.json is only a fallback: it is written occasionally (so it goes
// stale for hours) and mixes samples from every org/account the app has signed into.
function tzOffsetMs(utcMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000;
}
function wallToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo, d, h, mi);
  let t = guess - tzOffsetMs(guess, tz);
  t = guess - tzOffsetMs(t, tz); // re-evaluate across a DST edge
  return t;
}
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseResetTime(str, tz, now = Date.now()) {
  const m = /^(?:([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s+at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(String(str || "").trim());
  if (!m) return null;
  try {
    let h = Number(m[3]) % 12; if (m[5].toLowerCase() === "pm") h += 12;
    const mi = Number(m[4] || 0);
    const today = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
    let t;
    if (m[1]) {
      const mo = MONTHS.indexOf(m[1].toLowerCase()); if (mo < 0) return null;
      t = wallToUtc(+today.year, mo, Number(m[2]), h, mi, tz);
      if (t < now - 30 * 86400e3) t = wallToUtc(+today.year + 1, mo, Number(m[2]), h, mi, tz); // rolled past new year
    } else {
      t = wallToUtc(+today.year, +today.month - 1, +today.day, h, mi, tz);
      if (t < now - 60e3) t += 86400e3; // "11pm" already past today -> tomorrow
    }
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

// Pulls "<pct>% used · resets <when> (<tz>)" for the given label out of /usage's text.
function parseUsageLine(text, label) {
  const m = new RegExp(label + "[^:\\n]*:\\s*(\\d{1,3})%\\s*used(?:\\s*·\\s*resets\\s+([^\\n(]+?)\\s*(?:\\(([^)\\n]+)\\))?\\s*$)?", "im").exec(text);
  if (!m) return null;
  return { pct: Math.min(100, Number(m[1])), resetsAt: m[2] && m[3] ? parseResetTime(m[2], m[3].trim()) : null };
}
function parseUsageText(text) {
  const five = parseUsageLine(text, "Current session");
  const week = parseUsageLine(text, "Current week \\(all models\\)");
  return five && week ? { five, week } : null;
}

// Run from a dedicated dir with --no-session-persistence so polling never writes a
// transcript (which would show up as a phantom session on the board).
const USAGE_CWD = path.join(CODESHELF_DIR, "usage-probe");
const USAGE_TTL_MS = 45000; // the page polls every few seconds; spawn at most this often
function fetchLiveUsage() {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      fs.mkdirSync(USAGE_CWD, { recursive: true });
      const c = spawn(findClaudeBinary(), ["-p", "--no-session-persistence", "/usage"], { cwd: USAGE_CWD, env: process.env, stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch {} fin(null); }, 20000);
      t.unref?.();
      c.stdout.setEncoding("utf8");
      c.stdout.on("data", (d) => { if (out.length < 65536) out += d; });
      c.on("error", () => { clearTimeout(t); fin(null); });
      c.on("close", () => { clearTimeout(t); fin(parseUsageText(out)); });
    } catch { fin(null); }
  });
}

// Which org the CLI is signed into — lets the history fallback ignore other accounts.
let cliOrgCache = { at: 0, org: null };
async function cliOrgId() {
  if (Date.now() - cliOrgCache.at < 10 * 60e3) return cliOrgCache.org;
  const org = await new Promise((resolve) => {
    try {
      const c = spawn(findClaudeBinary(), ["auth", "status"], { stdio: ["ignore", "pipe", "ignore"], env: process.env });
      let out = "";
      const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch {} resolve(null); }, 8000);
      t.unref?.();
      c.stdout.setEncoding("utf8");
      c.stdout.on("data", (d) => (out += d));
      c.on("error", () => { clearTimeout(t); resolve(null); });
      c.on("close", () => { clearTimeout(t); try { resolve(JSON.parse(out).orgId || null); } catch { resolve(null); } });
    } catch { resolve(null); }
  });
  cliOrgCache = { at: Date.now(), org };
  return org;
}

const downsampleSeries = (pts, n = 64) => {
  if (pts.length <= n) return pts;
  const step = pts.length / n, out = [];
  for (let i = 0; i < n; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
};

// Our own record of live readings (for the sparklines): ~/.codeshelf/usage-live.json.
const USAGE_LIVE_FILE = path.join(CODESHELF_DIR, "usage-live.json");
const USAGE_KEEP_MS = 8 * 24 * 3600e3;
let liveSamples = null; // [{t, fh, sd}]
function loadLiveSamples() {
  if (liveSamples) return liveSamples;
  try { const d = JSON.parse(fs.readFileSync(USAGE_LIVE_FILE, "utf8")); liveSamples = Array.isArray(d) ? d.filter((x) => x && x.t && Number.isFinite(x.fh) && Number.isFinite(x.sd)) : []; }
  catch { liveSamples = []; }
  return liveSamples;
}
function recordLiveSample(fh, sd) {
  const arr = loadLiveSamples(), now = Date.now(), last = arr[arr.length - 1];
  // Keep a point when the value moved, or every ~5 min so a flat line still has shape.
  if (last && last.fh === fh && last.sd === sd && now - last.t < 5 * 60e3) return;
  arr.push({ t: now, fh, sd });
  while (arr.length && arr[0].t < now - USAGE_KEEP_MS) arr.shift();
  try { fs.mkdirSync(CODESHELF_DIR, { recursive: true }); fs.writeFileSync(USAGE_LIVE_FILE, JSON.stringify(arr), { mode: 0o600 }); } catch {}
}

// Desktop-app history for ONE org, oldest first (the fallback + older sparkline history).
async function readHistorySamples(org) {
  try {
    const d = JSON.parse(await fsp.readFile(USAGE_FILE, "utf8"));
    return (Array.isArray(d.samples) ? d.samples : [])
      .filter((x) => x && x.t && x.u && (x.u.fh != null || x.u.sd != null) && (!org || !x.org || x.org === org));
  } catch { return []; }
}

async function buildUsage() {
  const org = await cliOrgId();
  const live = await fetchLiveUsage();
  const now = Date.now();
  if (live) {
    recordLiveSample(live.five.pct, live.week.pct);
    const mine = loadLiveSamples();
    const firstLive = mine.length ? mine[0].t : now;
    const hist = (await readHistorySamples(org)).filter((x) => x.t < firstLive);
    const series = (key, ms, hk) => downsampleSeries([
      ...hist.filter((x) => x.t >= now - ms).map((x) => ({ t: x.t, v: Number(x.u[hk]) || 0 })),
      ...mine.filter((x) => x.t >= now - ms).map((x) => ({ t: x.t, v: x[key] })),
    ]);
    return {
      available: true, live: true, updatedAt: now,
      fiveHour: { current: live.five.pct, resetsAt: live.five.resetsAt, series: series("fh", 24 * 3600e3, "fh") },
      weekly: { current: live.week.pct, resetsAt: live.week.resetsAt, series: series("sd", 7 * 24 * 3600e3, "sd") },
    };
  }
  // Live read failed (CLI missing / logged out / API-key auth): keep the last good live
  // reading if we have one, flagged stale; otherwise fall back to the app's history file.
  const prev = usageCache.data;
  if (prev && prev.live) return { ...prev, live: false, stale: true };
  const samples = await readHistorySamples(org);
  if (!samples.length) return { available: false };
  const last = samples[samples.length - 1];
  const pts = (hk, ms) => downsampleSeries(samples.filter((x) => x.t >= now - ms && x.u[hk] != null).map((x) => ({ t: x.t, v: Number(x.u[hk]) || 0 })));
  return {
    available: true, live: false, stale: true, updatedAt: last.t,
    fiveHour: { current: Number(last.u.fh) || 0, series: pts("fh", 24 * 3600e3) },
    weekly: { current: Number(last.u.sd) || 0, series: pts("sd", 7 * 24 * 3600e3) },
  };
}

let usageCache = { at: 0, data: null }, usageInflight = null;
async function readUsage() {
  if (usageCache.data && Date.now() - usageCache.at < USAGE_TTL_MS) return usageCache.data;
  if (!usageInflight) {
    usageInflight = buildUsage()
      .then((d) => { usageCache = { at: Date.now(), data: d }; return d; })
      .finally(() => { usageInflight = null; });
  }
  return usageInflight;
}

// ---------------------------------------------------------------------------
// Sending a message
// ---------------------------------------------------------------------------

// Resolved once and cached (the login-shell probe spawns a subprocess). Reset on an
// explicit re-check so a freshly-installed claude is picked up without a restart.
let claudeBinCache = null;
function findClaudeBinary() { return claudeBinCache || (claudeBinCache = resolveClaudeBinary()); }
function resetClaudeBinary() { claudeBinCache = null; }
// Find the `claude` CLI wherever it lives, in order of confidence/cost:
// explicit override → this process's PATH → common install dirs → the desktop app's
// bundled copy → the user's LOGIN shell PATH. The last step matters because a server
// launched by a GUI app inherits a minimal PATH, so a claude installed via nvm/volta/
// bun/asdf/homebrew/etc. is invisible until we ask the login shell (which sources the
// user's profile) where it is.
function resolveClaudeBinary() {
  const win = process.platform === "win32";
  const exe = win ? "claude.exe" : "claude";
  if (process.env.CLAUDE_BIN && fs.existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  const onPath = whichOnPath(exe);
  if (onPath) return onPath;
  for (const c of staticClaudePaths(win)) { try { if (fs.existsSync(c)) return c; } catch {} }
  const bundled = newestBundledClaude(win);
  if (bundled) return bundled;
  const viaShell = whichViaLoginShell(exe);
  if (viaShell) return viaShell;
  return exe; // last resort: hope PATH has it at spawn time
}
// Scan THIS process's PATH for the executable (no subprocess).
function whichOnPath(cmd) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const names = process.platform === "win32" ? [cmd, "claude.cmd", "claude.bat"] : [cmd];
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}
// Common static install locations across package managers / version managers.
function staticClaudePaths(win) {
  const list = [path.join(HOME, ".claude", "local", win ? "claude.exe" : "claude")];
  if (win) {
    const appdata = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
    const localapp = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
    list.push(path.join(appdata, "npm", "claude.exe"), path.join(localapp, "Programs", "claude", "claude.exe"));
  } else {
    list.push(
      "/opt/homebrew/bin/claude", "/usr/local/bin/claude", "/usr/bin/claude",
      path.join(HOME, ".local", "bin", "claude"),
      path.join(HOME, ".bun", "bin", "claude"),
      path.join(HOME, ".volta", "bin", "claude"),
      path.join(HOME, ".npm-global", "bin", "claude"),
      path.join(HOME, "bin", "claude"),
    );
  }
  return list;
}
// The desktop app's bundled CLI (newest). It nests under claude-code/<version>/<hash>/…
// where the <hash> level varies by build, so match both one- and two-level layouts.
function newestBundledClaude(win) {
  let globs = [];
  if (win) {
    const cc = path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Claude", "claude-code");
    globs = [path.join(cc, "*", "*", "claude.exe"), path.join(cc, "*", "*", "*", "claude.exe")];
  } else if (process.platform === "darwin") {
    const cc = path.join(HOME, "Library/Application Support/Claude/claude-code");
    globs = [path.join(cc, "*", "*", "claude.app/Contents/MacOS/claude"), path.join(cc, "*", "claude.app/Contents/MacOS/claude")];
  } else {
    const cc = path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, ".config"), "Claude", "claude-code");
    globs = [path.join(cc, "*", "*", "claude"), path.join(cc, "*", "*", "*", "claude")];
  }
  try {
    let all = [];
    for (const g of globs) { try { all = all.concat(fs.globSync(g)); } catch {} }
    if (all.length) return [...new Set(all)].sort().slice(-1)[0];
  } catch { /* globSync may be unavailable on very old Node */ }
  return null;
}
// Ask the user's LOGIN+interactive shell where claude is — this sources their profile
// and rc files, so version-manager / custom-dir installs resolve. POSIX only; guarded
// by a timeout and ignored stdin so a slow or interactive profile can't hang us.
function whichViaLoginShell(exe) {
  if (process.platform === "win32") return null;
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const r = spawnSync(shell, ["-ilc", "command -v " + exe], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
    const lines = (r.stdout || "").split("\n").map((s) => s.trim()).filter(Boolean);
    for (const line of lines.reverse()) {
      if (line.includes("/") && fs.existsSync(line)) return line; // require a real path, not a builtin/alias
    }
  } catch { /* shell missing or timed out */ }
  return null;
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

// ---------------------------------------------------------------------------
// API key (set through the UI). Persisted to ~/.codeshelf/config.json at 0600 and
// injected into the `claude` child via ANTHROPIC_API_KEY. A key the user already
// had in the environment is remembered so clearing the UI key restores it rather
// than wiping their setup.
// ---------------------------------------------------------------------------
const ORIGINAL_ENV_KEY = process.env.ANTHROPIC_API_KEY || "";
let managedKey = "";
// Advisory usage budgets (track + warn only — CodeShelf can't enforce the real plan
// limit). fiveHourPct/weeklyPct are caps on the plan gauges; projects maps a project
// name to its max share (%) of this week's tracked usage. 0 = no budget set.
let budgets = { fiveHourPct: 0, weeklyPct: 0, projects: {} };
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
function normalizeBudgets(b) {
  const out = { fiveHourPct: clampPct(b?.fiveHourPct), weeklyPct: clampPct(b?.weeklyPct), projects: {} };
  if (b && b.projects && typeof b.projects === "object") {
    for (const [k, v] of Object.entries(b.projects)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue; // no prototype pollution
      if (typeof k === "string" && k && clampPct(v) > 0) out.projects[k.slice(0, 200)] = clampPct(v);
    }
  }
  return out;
}
function saveBudgets(b) { budgets = normalizeBudgets(b); return persistConfig(); }
// Validate before storing: non-empty, no whitespace/control chars (it goes into a
// child process env), sane length. We don't hard-require the sk-ant- prefix so
// gateway/proxy keys still work; the UI nudges if it looks off.
function validApiKey(k) {
  return typeof k === "string" && k.length >= 8 && k.length <= 500 && !/[\s\u0000-\u001f\u007f]/.test(k);
}
function effectiveKey() { return managedKey || ORIGINAL_ENV_KEY; }
function maskKey(k) { return k ? "••••" + k.slice(-4) : ""; }
// Keep process.env in sync so every spawned `claude` picks up the active key.
function applyKey() {
  const k = effectiveKey();
  if (k) process.env.ANTHROPIC_API_KEY = k;
  else delete process.env.ANTHROPIC_API_KEY;
}
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const cfg = JSON.parse(raw);
    if (typeof cfg.apiKey === "string" && cfg.apiKey) managedKey = cfg.apiKey;
    if (cfg.budgets && typeof cfg.budgets === "object") budgets = normalizeBudgets(cfg.budgets);
  } catch { /* no config yet */ }
  applyKey();
}
function persistConfig() {
  try {
    fs.mkdirSync(CODESHELF_DIR, { recursive: true });
    atomicWrite(CONFIG_FILE, JSON.stringify({ apiKey: managedKey, budgets })); // temp+rename so a crash can't truncate the key
    return true;
  } catch { return false; }
}
function saveApiKey(k) { managedKey = k; applyKey(); authCache = { at: 0, loggedIn: false, checked: false }; return persistConfig(); }
function clearApiKey() { managedKey = ""; applyKey(); authCache = { at: 0, loggedIn: false, checked: false }; return persistConfig(); }
loadConfig();
loadQueues(); // rehydrate any queue persisted before a restart and resume draining

// Who the CLI is authed as, for the account panel. With a configured API key the
// identity is the masked key; otherwise parse `claude auth status` for an account.
async function accountInfo() {
  const key = effectiveKey();
  if (key) {
    return { loggedIn: true, method: "apikey", account: maskKey(key), keySet: !!managedKey, envKey: !managedKey && !!ORIGINAL_ENV_KEY };
  }
  const bin = findClaudeBinary();
  const account = await new Promise((resolve) => {
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const c = spawn(bin, ["auth", "status"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
      let out = "";
      const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch {} fin(""); }, 8000); t.unref?.();
      c.stdout.setEncoding("utf8"); c.stdout.on("data", (d) => (out += d));
      c.on("error", () => { clearTimeout(t); fin(""); });
      c.on("close", () => {
        clearTimeout(t);
        let acc = "";
        try { const j = JSON.parse(out); acc = j.email || j.account || j.user || j.organization || j.org || ""; } catch {}
        if (!acc) { const m = out.match(/[\w.+-]+@[\w-]+\.[\w.-]+/); if (m) acc = m[0]; }
        fin(acc);
      });
    } catch { fin(""); }
  });
  const loggedIn = await checkLoggedIn();
  const info = { loggedIn, method: loggedIn ? "oauth" : "none", account, keySet: false, envKey: false };
  // Surface a browser-login attempt that failed/ended without producing a session,
  // so the modal's spinner can turn into an actionable error instead of just timing out.
  if (!loggedIn && loginProc) {
    if (loginProc.running) info.loginInProgress = true;
    else if (loginProc.error) info.loginError = loginProc.error;
  }
  return info;
}

// Browser-login child state. The CLI's `auth login --claudeai` opens the system
// browser and runs a local callback listener; it's long-lived (~until the user
// finishes in the browser) and non-interactive, but if we hand it stdio:"ignore"
// a prompt (org picker, etc.) EOFs its stdin and it dies without saving tokens.
// We keep it attached, buffer stderr for the UI, and only ever have one running.
let loginProc = null; // { pid, running, startedAt, stderr, error }
function stopLoginProc() { try { if (loginProc?.child) loginProc.child.kill("SIGTERM"); } catch {} }
function startLoginProc() {
  if (loginProc?.running) return { ok: true, alreadyRunning: true };
  const bin = findClaudeBinary();
  if (!bin || !fs.existsSync(bin))
    return { ok: false, message: "Couldn't find the claude CLI. Set CLAUDE_BIN to its full path." };
  try {
    // stdio: inherit stdin from /dev/null (no interactive prompts answerable
    // from here anyway), but PIPE stdout+stderr so (a) a prompt doesn't EOF-crash
    // the child and (b) we can surface failure reasons back to the UI.
    const child = spawn(bin, ["auth", "login", "--claudeai"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    const state = { child, pid: child.pid, running: true, startedAt: Date.now(), stdout: "", stderr: "", error: "" };
    // Keep only the tail — the login flow prints a URL and a success/failure line.
    const take = (buf, chunk) => (buf + chunk).slice(-4096);
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");
    child.stdout?.on?.("data", (d) => { state.stdout = take(state.stdout, d); });
    child.stderr?.on?.("data", (d) => { state.stderr = take(state.stderr, d); });
    child.on("error", (e) => {
      state.running = false;
      state.error = state.error || `Couldn't start ${path.basename(bin)}: ${e.message}`;
    });
    child.on("close", async (code) => {
      state.running = false;
      // If the CLI ended but we're not actually signed in, surface the stderr tail
      // (or a generic hint). Give the keychain a moment to settle before checking.
      await new Promise((r) => setTimeout(r, 400));
      authCache = { at: 0, loggedIn: false, checked: false };
      const nowIn = await checkLoggedIn();
      if (!nowIn) {
        const detail = (state.stderr || state.stdout || "").trim().split("\n").slice(-4).join(" ").slice(0, 300);
        state.error = detail || (code === 0
          ? "The sign-in window closed before a token was captured. Try again, and don't close the browser tab until it says you can close it."
          : `claude auth login exited with code ${code}.`);
      }
    });
    loginProc = state;
    return { ok: true, pid: child.pid };
  } catch (e) {
    return { ok: false, message: String(e.message || e).slice(0, 300) };
  }
}

const inFlightSends = new Set();
const inFlightTypes = new Set(); // sessions with an in-progress live-window paste

async function sendToSession(sessionId, message, model, effort, attachments, mode) {
  if (!UUID_RE.test(sessionId)) return { ok: false, reason: "badid", message: "Invalid session id." };
  if (model && !modelAllowed(model)) return { ok: false, reason: "badmodel", message: "Unknown model." };
  if (effort && !ALLOWED_EFFORT.has(effort)) return { ok: false, reason: "badeffort", message: "Unknown effort level." };
  if (mode && !ALLOWED_PERMISSION_MODES.has(mode)) return { ok: false, reason: "badmode", message: "Unknown permission mode." };
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
  if (mode) args.push("--permission-mode", mode);
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
// The desktop app applies a pasted `/model <id>` right away (no confirmation prompt),
// so we don't wait on anything: type `/model`, give the app a beat to take the command,
// then type the message. Env-tunable if the message ever races ahead of the switch.
const MODEL_SWITCH_SETTLE_MS = Math.max(0, Number(process.env.CE_MODEL_SWITCH_SETTLE_MS) || 400);
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
    -- Give any autocomplete the paste triggered (notably the /model picker) time to
    -- render and filter before Enter, so Enter commits the right thing rather than
    -- firing into a half-drawn menu.
    delay 0.45
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

// Interrupt the running turn: front the session, press Escape (the app's own "stop"),
// then hand focus back. Same front/restore dance as PASTE_SCRIPT, minus the paste.
const INTERRUPT_SCRIPT = `on run argv
  set prevApp to item 1 of argv
  tell application "System Events"
    set claudeProcs to (every application process whose name is "Claude")
    if claudeProcs is {} then set claudeProcs to (every application process whose name contains "Claude" and background only is false)
    if claudeProcs is {} then return "NOCLAUDE"
    set frontmost of item 1 of claudeProcs to true
  end tell
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
  tell application "System Events" to key code 53
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

// Shared precondition check for the live-window actions (type / interrupt): on macOS,
// the session must still be live and carry a host-session id (for the deep link).
// Returns { ok, host } or a { ok:false, reason, message } the endpoints pass through.
async function resolveLiveHost(sessionId) {
  if (process.platform !== "darwin")
    return { ok: false, reason: "platform", message: "Live-window control is only supported on macOS." };
  if (!UUID_RE.test(sessionId)) return { ok: false, reason: "badid", message: "Invalid session id." };
  const live = (await readLiveRegistry()).get(sessionId);
  if (!live) return { ok: false, reason: "notlive", message: "This session isn't live anymore — reopen it, or send a separate turn here." };
  const host = live.hostSessionId;
  if (!host || !HOST_SESSION_RE.test(host))
    return { ok: false, reason: "nolink", message: "No app link for this session, so it can't be controlled in the live window." };
  return { ok: true, host };
}

// Front the live session and press Escape to stop whatever it's generating.
async function interruptLiveWindow(sessionId) {
  const r = await resolveLiveHost(sessionId);
  if (!r.ok) return r;
  if (inFlightTypes.has(sessionId))
    return { ok: false, reason: "inflight", message: "Busy delivering to the live window — one moment." };
  inFlightTypes.add(sessionId);
  try {
    const deepLink = sessionDeepLink(r.host);
    const pre = await runProc("/usr/bin/osascript", ["-e", FRONT_APP_SCRIPT]);
    if (pre.code !== 0 && A11Y_RE.test(pre.err))
      return { ok: false, reason: "accessibility", message: "macOS blocked the automation — Accessibility permission is needed." };
    const prevApp = pre.code === 0 ? pre.out.trim() : "";
    const op = await runProc("/usr/bin/open", ["-g", deepLink]);
    if (op.code !== 0)
      return { ok: false, reason: "open", message: "Couldn't open the live session in the Claude app. Is the app installed?" };
    await new Promise((res) => setTimeout(res, LIVE_FOCUS_MS));
    const os = await runProc("/usr/bin/osascript", ["-e", INTERRUPT_SCRIPT, prevApp]);
    if (os.code !== 0) {
      if (A11Y_RE.test(os.err))
        return { ok: false, reason: "accessibility", message: "macOS blocked the keystrokes — Accessibility permission is needed." };
      return { ok: false, reason: "osascript", message: (os.err.trim() || "Couldn't interrupt the live window.").slice(0, 500) };
    }
    if (os.out.includes("NOCLAUDE"))
      return { ok: false, reason: "noapp", message: "The Claude app doesn't seem to be running. Open it, then try again." };
    if (os.out.includes("NOTFRONT"))
      return { ok: false, reason: "notfront", message: "Couldn't focus the Claude window to interrupt it. Try again." };
    return { ok: true };
  } finally {
    inFlightTypes.delete(sessionId);
  }
}

// Remembers the model we last switched each live window to, so we only re-type
// `/model` when it actually changes (callers — the manual path and the queue
// drain — both pass the desired model every time). Keyed by session id.
const liveAppliedModel = new Map();
async function typeIntoLiveWindow(sessionId, message, model) {
  const r = await resolveLiveHost(sessionId);
  if (!r.ok) return r;
  const host = r.host;

  // One paste at a time per session — overlapping automations would double-open and
  // fight over the frontmost app.
  if (inFlightTypes.has(sessionId))
    return { ok: false, reason: "inflight", message: "Still delivering your last message to the live window — one moment." };
  inFlightTypes.add(sessionId);
  try {
    // A different model is applied in the live window itself with `/model <id>` (the
    // validated pattern is argv/paste-safe), typed first, so the reply runs on it on
    // the desktop app — switching the model there — instead of as a separate headless
    // turn. Skip it when the window is already on that model (avoids a redundant
    // `/model` per queued message).
    const switching = model && modelAllowed(model) && liveAppliedModel.get(sessionId) !== model;
    // The /model paste is a normal paste (focus returns right away); the message follows
    // after a short settle — nothing is awaited.
    const parts = switching
      ? [{ text: `/model ${model}`, hold: MODEL_SWITCH_SETTLE_MS }, { text: message }]
      : [{ text: message }];
    const res = await typeIntoLiveWindowInner(host, parts);
    if (res.ok && switching) liveAppliedModel.set(sessionId, model);
    return res;
  } finally {
    inFlightTypes.delete(sessionId);
  }
}

async function typeIntoLiveWindowInner(host, messages) {
  const deepLink = sessionDeepLink(host);

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

  // 1. Put the first message on the clipboard (stdin → pbcopy; no shell, no escaping).
  const cp = await runProc("/usr/bin/pbcopy", [], { input: messages[0].text });
  if (cp.code !== 0) return { ok: false, reason: "clipboard", message: "Couldn't set the clipboard." };

  // 2. Select the right live session in the BACKGROUND (-g = don't bring the app
  //    to the front), so switching sessions never steals the user's focus.
  // NOTE: for LOCAL desktop sessions (hostSessionId "local_…") this deep link does not
  //    reliably switch the app's active conversation — the paste then lands in whichever
  //    conversation is already frontmost. Known limitation; see the targeting guard below.
  const op = await runProc("/usr/bin/open", ["-g", deepLink]);
  if (op.code !== 0) {
    if (savedClip) await runProc("/usr/bin/pbcopy", [], { input: savedClip });
    return { ok: false, reason: "open", message: "Couldn't open the live session in the Claude app. Is the app installed?" };
  }

  // 3. Let the app load/focus that session + its composer while still backgrounded
  //    (invisible to the user), THEN flash to the front just long enough to paste,
  //    and restore focus to `prevApp`.
  await new Promise((r) => setTimeout(r, LIVE_FOCUS_MS));
  const pasteArgs = () => ["-e", PASTE_SCRIPT, prevApp];
  let os = await runProc("/usr/bin/osascript", pasteArgs());
  // Remaining messages (the real prompt after a `/model` switch): a short settle so the
  // command is taken, then paste the next one.
  for (let i = 1; i < messages.length && os.code === 0 && os.out.includes("OK"); i++) {
    await new Promise((r) => setTimeout(r, messages[i - 1].hold ?? 250));
    await runProc("/usr/bin/pbcopy", [], { input: messages[i].text });
    os = await runProc("/usr/bin/osascript", pasteArgs());
  }
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
  if (model && !modelAllowed(model)) return { ok: false, message: "Unknown model." };
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
    if (size > max) { const e = new Error("body too large"); e.tooLarge = true; throw e; }
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
// Map a readBody failure to the right status: 413 for oversize, 400 for bad JSON.
function bodyFail(res, e) {
  if (e && e.tooLarge) return sendJSON(res, 413, { ok: false, message: "Request body too large." });
  return sendJSON(res, 400, { ok: false, message: "Invalid request body." });
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
        const acct = currentAccount();
        return sendJSON(res, 200, { sessions, counts, usageTotals, account: { email: acct.email, name: acct.name }, generatedAt: Date.now() });
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
        const pmode = typeof body.mode === "string" && body.mode ? body.mode : undefined;
        const result = await sendToSession(sessionId, msg, model, effort, attachments, pmode);
        // Logical failures come back as 200 so the client can render a helpful
        // message (auth guidance, etc.) rather than a thrown generic error.
        return sendJSON(res, 200, result);
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/queue") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/queue".length));
        if (!UUID_RE.test(sessionId)) return sendJSON(res, 400, { ok: false, message: "Invalid session id." });
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const msg = typeof body.message === "string" ? body.message.trim() : "";
        if (!msg) return sendJSON(res, 400, { ok: false, message: "Empty message." });
        if (msg.length > 32000) return sendJSON(res, 413, { ok: false, message: "Message too long." });
        const model = typeof body.model === "string" && body.model ? body.model : undefined;
        const effort = typeof body.effort === "string" && body.effort ? body.effort : undefined;
        const pmode = typeof body.mode === "string" && body.mode ? body.mode : undefined;
        const r = enqueuePrompt(sessionId, { text: msg, model, effort, mode: pmode });
        if (!r.ok) return sendJSON(res, r.code || 400, { ok: false, message: r.message });
        return sendJSON(res, 200, { ok: true, queue: queueView(sessionId) });
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/dequeue") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/dequeue".length));
        if (!UUID_RE.test(sessionId)) return sendJSON(res, 400, { ok: false, message: "Invalid session id." });
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const ok = dequeuePrompt(sessionId, String(body.itemId || ""));
        return sendJSON(res, 200, { ok, queue: queueView(sessionId) });
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/requeue") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/requeue".length));
        if (!UUID_RE.test(sessionId)) return sendJSON(res, 400, { ok: false, message: "Invalid session id." });
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const ok = requeuePrompt(sessionId, String(body.itemId || ""));
        return sendJSON(res, 200, { ok, queue: queueView(sessionId) });
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/livetype") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/livetype".length));
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const msg = typeof body.message === "string" ? body.message.trim() : "";
        if (!msg) return sendJSON(res, 400, { ok: false, message: "Empty message." });
        if (msg.length > 32000) return sendJSON(res, 413, { ok: false, message: "Message too long." });
        const model = typeof body.model === "string" && body.model ? body.model : undefined;
        if (model && !modelAllowed(model)) return sendJSON(res, 400, { ok: false, message: "Unknown model." });
        const result = await typeIntoLiveWindow(sessionId, msg, model);
        return sendJSON(res, 200, result);
      }

      if (p.startsWith("/api/sessions/") && p.endsWith("/livestop") && req.method === "POST") {
        const sessionId = decodeURIComponent(p.slice("/api/sessions/".length, -"/livestop".length));
        try { await readBody(req); } catch (e) { return bodyFail(res, e); } // same-site/JSON gate
        const result = await interruptLiveWindow(sessionId);
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
        // ?refresh=1 drops the 45s cache so the user's "re-read" button gets a
        // fresh `claude -p /usage` reading. The in-flight de-dupe still protects
        // us from a click burst spawning multiple CLIs.
        if (url.searchParams.get("refresh")) usageCache = { at: 0, data: usageCache.data };
        return sendJSON(res, 200, await readUsage());
      }

      if (p === "/api/meta" && req.method === "GET") {
        // ?recheck=1 forces a fresh `claude auth status` (bypass the 30s cache),
        // so the "check again" button reflects a login that just happened.
        if (url.searchParams.get("recheck")) { authCache = { at: 0, loggedIn: false, checked: false }; resetClaudeBinary(); }
        const sessions = await getSessionList();
        const folders = [...new Map(sessions.filter((s) => s.cwd).map((s) => [s.cwd, { cwd: s.cwd, project: s.project }])).values()]
          .sort((a, b) => a.project.localeCompare(b.project));
        // A configured API key is itself a working credential, so count it as logged in.
        const loggedIn = effectiveKey() ? true : await checkLoggedIn();
        return sendJSON(res, 200, { loggedIn, loginCmd: loginCommand(), folders, rcUrl: RC_URL, platform: process.platform });
      }

      if (p === "/api/account" && req.method === "GET") {
        return sendJSON(res, 200, await accountInfo());
      }

      if (p === "/api/budgets" && req.method === "GET") {
        return sendJSON(res, 200, budgets);
      }

      if (p === "/api/budgets" && req.method === "POST") {
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const ok = saveBudgets(body);
        return sendJSON(res, 200, { ok, budgets });
      }

      if (p === "/api/apikey" && req.method === "POST") {
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
        const key = typeof body.key === "string" ? body.key.trim() : "";
        if (!validApiKey(key)) return sendJSON(res, 400, { ok: false, message: "That doesn't look like a valid key (no spaces, 8–500 chars)." });
        const ok = saveApiKey(key);
        if (!ok) return sendJSON(res, 500, { ok: false, message: "Couldn't save the key to disk." });
        return sendJSON(res, 200, { ok: true, keyMasked: maskKey(key), looksAnthropic: /^sk-ant-/.test(key) });
      }

      if (p === "/api/apikey/clear" && req.method === "POST") {
        const ok = clearApiKey();
        return sendJSON(res, 200, { ok, account: await accountInfo() });
      }

      if (p === "/api/login" && req.method === "POST") {
        // If a previous attempt is still running, surface that rather than start a
        // second CLI listening on the same callback port. The client polls
        // /api/account for the actual flip to logged in.
        authCache = { at: 0, loggedIn: false, checked: false };
        const r = startLoginProc();
        return sendJSON(res, 200, r);
      }

      if (p === "/api/logout" && req.method === "POST") {
        const bin = findClaudeBinary();
        const r = await runProc(bin, ["auth", "logout"], { timeoutMs: 15000 });
        authCache = { at: 0, loggedIn: false, checked: false };
        if (r.code === 0) return sendJSON(res, 200, { ok: true });
        const detail = (r.err || r.out || "").trim();
        return sendJSON(res, 200, { ok: false, message: detail.slice(0, 300) || "Logout isn't supported by this CLI — sign out from the terminal." });
      }

      if (p === "/api/new" && req.method === "POST") {
        let body;
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
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
        try { body = await readBody(req); } catch (e) { return bodyFail(res, e); }
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
  console.log(`  live-window typing: ${process.platform === "darwin" ? "on (macOS; needs Accessibility permission on first use)" : "off (macOS only)"}`);
  if (bindWildcard) {
    console.log(`  ⚠  Bound to ${HOST} — reachable beyond this machine. The access token is required,`);
    console.log(`     but prefer the default 127.0.0.1 bind unless you understand the exposure.`);
  }
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log(`  ⚠  ${PROJECTS_DIR} not found — is this the right machine?`);
  }
  console.log(`  press Ctrl+C to stop\n`);
});
