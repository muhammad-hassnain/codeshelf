// CodeShelf frontend
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const TOKEN = $('meta[name="ce-token"]')?.content || "";

async function api(path, opts = {}) {
  const headers = { "X-CE-Token": TOKEN, ...(opts.headers || {}) };
  const r = await fetch(path, { ...opts, headers });
  if (!r.ok) {
    let msg = `Request failed (${r.status})`;
    try { msg = (await r.json()).message || msg; } catch {}
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return r.json();
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, no emoji)
// ---------------------------------------------------------------------------
const P = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  monitor: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 21h8M12 16.5V21"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  branch: '<circle cx="6" cy="6" r="2.3"/><circle cx="6" cy="18" r="2.3"/><circle cx="17" cy="9" r="2.3"/><path d="M6 8.3v7.4"/><path d="M17 11.3a7 7 0 0 1-7 6.7"/>',
  terminal: '<path d="M4 17l6-5-6-5"/><path d="M12.5 19H20"/>',
  result: '<path d="M4 5v6a2 2 0 0 0 2 2h12"/><path d="m15 9 4 4-4 4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15.5 16 10 5 21"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  reply: '<path d="M9 15 4 10l5-5"/><path d="M20 19v-5a4 4 0 0 0-4-4H4.5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.6 3.8 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.4 3.8a2 2 0 0 0-2.8 0Z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  layers: '<path d="M12 3 21 8l-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  paperclip: '<path d="M21.4 11 12.2 20.2a6 6 0 0 1-8.5-8.5l9.2-9.1a4 4 0 0 1 5.7 5.6l-9.2 9.2a2 2 0 0 1-2.8-2.9l8.5-8.4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  sliders: '<path d="M4 6h8M16 6h4M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="14" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  caret: '<path d="m6 9 6 6 6-6"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 8-8"/><path d="m16 7 2.5 2.5"/><path d="m13.5 9.5 2.5 2.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  check2: '<path d="M20 6 9 17l-5-5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
};
function svg(name, cls = "ic") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}
function statusIcon(status) {
  const m = { working: "activity", waiting: "reply", closed: "check" };
  if (m[status]) return svg(m[status], "ic-sm");
  return `<svg class="ic-sm" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>`;
}
const starIcon = (filled) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.6l6-.9z"/></svg>`;
// A shelf of books, each spine a pastel colour, the tallest marked </>.
const BRAND =
  '<svg viewBox="0 0 24 24" role="img" aria-label="CodeShelf">' +
  '<rect x="2.5" y="18.4" width="19" height="2.8" rx="1.2" fill="var(--accent-2)"/>' +
  '<rect x="4" y="8" width="3.4" height="10.6" rx="1" fill="var(--accent)"/>' +
  '<rect x="7.8" y="5.4" width="3.4" height="13.2" rx="1" fill="var(--wait-dot)"/>' +
  '<rect x="11.6" y="9" width="3.4" height="9.6" rx="1" fill="var(--work-dot)"/>' +
  '<rect x="15.9" y="7.3" width="3.2" height="11.3" rx="1" fill="var(--accent-2)" transform="rotate(9 17.5 13)"/>' +
  '<path d="M8.7 9.4 7.5 11l1.2 1.6M10.3 9.4 11.5 11l-1.2 1.6" fill="none" stroke="var(--bg-1)" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>' +
  "</svg>";

function setStaticIcons() {
  $("#brandMark").innerHTML = BRAND;
  $("#searchIco").innerHTML = svg("search", "ic-sm");
  $$("[data-icon]").forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
}

const STATUS = {
  working: { label: "Working", cls: "s-working", group: "Working", led: "var(--work-dot)" },
  waiting: { label: "Need input", cls: "s-waiting", group: "Need input", led: "var(--wait-dot)" },
  running: { label: "Active", cls: "s-running", group: "Active", led: "var(--accent)" },
  closed: { label: "Inactive", cls: "s-closed", group: "Inactive", led: "var(--idle-dot)" },
};
const GROUP_ORDER = ["waiting", "working", "running", "closed"];
// Flat list with optional `group` (for <optgroup>s). Aliases (opus/sonnet/…) always
// pick the latest in that family; the claude-… ids pin a specific version.
const MODELS = [
  { v: "", label: "Default model" },
  { v: "opus", label: "Opus (latest)", group: "Opus" },
  { v: "claude-opus-5-5", label: "Opus 5.5", group: "Opus" },
  { v: "claude-opus-4-8", label: "Opus 4.8", group: "Opus" },
  { v: "claude-opus-4-7", label: "Opus 4.7", group: "Opus" },
  { v: "sonnet", label: "Sonnet (latest)", group: "Sonnet" },
  { v: "claude-sonnet-5-5", label: "Sonnet 5.5", group: "Sonnet" },
  { v: "claude-sonnet-4-5", label: "Sonnet 4.5", group: "Sonnet" },
  { v: "haiku", label: "Haiku (latest)", group: "Haiku" },
  { v: "claude-haiku-4-5", label: "Haiku 4.5", group: "Haiku" },
  { v: "fable", label: "Fable (latest)", group: "Fable" },
  { v: "claude-fable-5-1", label: "Fable 5.1", group: "Fable" },
];
// Build <option>/<optgroup> markup for a model <select>, marking `selected`.
function modelOptionsHTML(selected) {
  let html = "", curGroup = null, open = false;
  for (const m of MODELS) {
    const g = m.group || null;
    if (g !== curGroup) {
      if (open) { html += "</optgroup>"; open = false; }
      if (g) { html += `<optgroup label="${esc(g)}">`; open = true; }
      curGroup = g;
    }
    html += `<option value="${esc(m.v)}" ${m.v === selected ? "selected" : ""}>${esc(m.label)}</option>`;
  }
  if (open) html += "</optgroup>";
  return html;
}
const EFFORT_VALUES = ["", "low", "medium", "high", "xhigh", "max"];
const PMODES = [{ v: "", label: "Default mode" }, { v: "auto", label: "Auto" }, { v: "acceptEdits", label: "Accept edits" }, { v: "plan", label: "Plan" }];
// Display names match the desktop app's effort picker; the values sent are the CLI's
// own --effort tokens (low, medium, high, xhigh, max). "Extra" is the desktop label
// for xhigh. Index 0 is "Default" — the model's own effort when --effort isn't passed.
const EFFORT_LABELS = ["Default", "Low", "Medium", "High", "Extra", "Max"];

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const state = {
  sessions: [], counts: {},
  statusFilter: "all", projectFilter: null, search: "",
  pins: new Set(lsGet("ce-pins", [])), firstPoll: true, totals: { fiveHour: 0, week: 0 },
  budgets: { fiveHourPct: 0, weeklyPct: 0, projects: {} }, lastUsage: null,
};
// Each project's share (%) of this week's tracked token usage — the basis for
// per-project budgets. Advisory: it's CodeShelf's own token accounting, not the plan.
function projectShares() {
  const byProj = {};
  for (const s of state.sessions) byProj[s.project] = (byProj[s.project] || 0) + (s.tokWeek || 0);
  const total = state.totals.week || 0;
  const out = {};
  for (const [p, t] of Object.entries(byProj)) out[p] = total ? (100 * t) / total : 0;
  return out;
}
// Projects currently over their budgeted weekly share.
function overBudgetProjects() {
  const shares = projectShares();
  const over = {};
  for (const [p, cap] of Object.entries(state.budgets.projects || {})) {
    if (cap > 0 && (shares[p] || 0) >= cap) over[p] = { share: Math.round(shares[p] || 0), cap };
  }
  return over;
}
async function loadBudgets() {
  try { state.budgets = await api("/api/budgets"); renderChips(); if (state.lastUsage) renderUsage(state.lastUsage); } catch {}
}
let meta = { loggedIn: true, loginCmd: "" };
let sigSignal = "", sigChips = "", sigContent = "";

// ---------------------------------------------------------------------------
// Load + render
// ---------------------------------------------------------------------------
async function loadSessions() {
  try {
    const data = await api("/api/sessions");
    state.sessions = data.sessions || [];
    state.counts = data.counts || {};
    state.totals = data.usageTotals || { fiveHour: 0, week: 0 };
    $("#updated").textContent = new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $("#content").setAttribute("aria-busy", "false");
    renderSignal(); renderChips(); renderUsageByProject();
    if (!state.search) renderContent();
    maybeNotify();
    state.firstPoll = false;
  } catch (e) {
    renderError("Can't reach the CodeShelf server", e.message, loadSessions);
  }
}
async function loadMeta() {
  try {
    const m = await api("/api/meta");
    const changed = m.loggedIn !== meta.loggedIn;
    meta = m;
    if (changed && convo.id && convo.data) renderComposer(convo.data);
  } catch {}
}

function renderSignal() {
  const c = state.counts;
  const tiles = [
    { key: "waiting", label: "Need input", n: c.waiting || 0, cls: "t-wait", ic: "reply", hot: (c.waiting || 0) > 0 },
    { key: "working", label: "Working", n: c.working || 0, cls: "t-work", ic: "activity" },
    { key: "closed", label: "Inactive", n: c.closed || 0, cls: "t-idle", ic: "check" },
  ];
  const sig = JSON.stringify([tiles.map((t) => t.n), state.statusFilter]);
  if (sig === sigSignal) return;
  sigSignal = sig;
  $("#signal").innerHTML = tiles.map((t) => {
    const on = state.statusFilter === t.key;
    return `
    <button class="tile ${t.cls} ${t.hot ? "hot" : ""} ${on ? "active" : ""}"
            data-status="${t.key}" aria-pressed="${on}" aria-label="${t.label}: ${t.n}${on ? ", filtering (click to clear)" : ", click to filter"}">
      <span class="tile-top"><span class="tled">${svg(t.ic, "ic-sm")}</span><span class="tile-num">${t.n}</span></span>
      <span class="tile-label">${t.label}${on ? ` · filtering` : ""}</span>
    </button>`;
  }).join("");
}

function renderChips() {
  const byProj = {};
  for (const s of state.sessions) byProj[s.project] = (byProj[s.project] || 0) + 1;
  const projects = Object.entries(byProj).sort((a, b) => b[1] - a[1]);
  const over = overBudgetProjects();
  const sig = JSON.stringify([projects, state.projectFilter, over]);
  if (sig === sigChips) return;
  sigChips = sig;
  const all = !state.projectFilter;
  $("#projectChips").innerHTML =
    `<button class="chip ${all ? "active" : ""}" data-project="" aria-pressed="${all}">All<span class="n">${state.sessions.length}</span></button>` +
    projects.map(([p, n]) => {
      const ob = over[p];
      const warn = ob ? `<span class="chip-over" title="Over budget: using ${ob.share}% of this week (budget ${ob.cap}%)">${svg("alert", "ic-sm")}</span>` : "";
      const alabel = ob ? ` aria-label="${esc(p)}, ${n} sessions — over budget, using ${ob.share}% of this week (budget ${ob.cap}%)"` : "";
      return `<button class="chip ${state.projectFilter === p ? "active" : ""} ${ob ? "over" : ""}" data-project="${esc(p)}" aria-pressed="${state.projectFilter === p}"${alabel}>${warn}${esc(p)}<span class="n">${n}</span></button>`;
    }).join("");
  requestAnimationFrame(updateChipFades);
}
// Fade the chip row's edges only where there's more to scroll, so a clipped row reads as scrollable, not broken.
function updateChipFades() {
  const el = $("#projectChips"); if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle("cl", el.scrollLeft > 4);
  el.classList.toggle("cr", el.scrollLeft < max - 4);
}

function filtered() {
  let list = state.sessions;
  if (state.statusFilter !== "all") list = list.filter((s) => s.status === state.statusFilter);
  if (state.projectFilter) list = list.filter((s) => s.project === state.projectFilter);
  return list;
}

function renderContent() {
  const list = filtered();
  const sig = JSON.stringify([state.statusFilter, state.projectFilter,
    list.map((s) => s.sessionId + s.status + s.lastTs + s.tokWeek + (state.pins.has(s.sessionId) ? "p" : ""))]);
  if (sig === sigContent) return;
  sigContent = sig;
  const content = $("#content");
  const keep = content.scrollTop;
  if (!list.length) {
    content.innerHTML = (state.statusFilter !== "all" || state.projectFilter)
      ? emptyState("layers", "Nothing here", "No sessions match the current filter. Clear the status or project filter to see more.")
      : emptyState("layers", "No sessions yet", "Start one with “+ New session”, and it’ll show up here.");
    return;
  }

  const pinned = list.filter((s) => state.pins.has(s.sessionId));
  const rest = list.filter((s) => !state.pins.has(s.sessionId));
  let html = "";
  if (pinned.length) html += groupHTML("Pinned", "var(--accent)", pinned, "");

  if (state.statusFilter === "all") {
    // group by status, "Need input" surfaced first and emphasised
    const groups = {};
    for (const s of rest) (groups[s.status] ||= []).push(s);
    for (const st of GROUP_ORDER) {
      if (!groups[st]?.length) continue;
      html += groupHTML(STATUS[st].group, STATUS[st].led, groups[st], st === "waiting" ? "g-urgent" : "");
    }
  } else if (rest.length) {
    const st = STATUS[state.statusFilter] || STATUS.closed;
    html += groupHTML(st.group, st.led, rest, state.statusFilter === "waiting" ? "g-urgent" : "");
  }
  content.innerHTML = html;
  content.scrollTop = keep;
}

function groupHTML(title, led, items, cls) {
  return `<section class="group"><h2 class="group-head ${cls}"><span class="led" style="background:${led}"></span>${esc(title)} <span class="gcount">${items.length}</span></h2><div class="cards">${items.map(card).join("")}</div></section>`;
}

const MODE_LABELS = { auto: "Auto", default: "Default", manual: "Manual", plan: "Plan", acceptEdits: "Accept edits", bypassPermissions: "Bypass", dontAsk: "Don't ask" };
function modeBadge(mode) {
  if (!mode) return "";
  const label = MODE_LABELS[mode] || (mode[0].toUpperCase() + mode.slice(1));
  const cls = /^[a-zA-Z]+$/.test(mode) ? mode : "other";
  return `<span class="mode mode-${cls}" title="Permission mode: ${esc(label)}">${esc(label)}</span>`;
}
// Friendly model names: "claude-opus-4-8" -> "Opus 4.8". The table covers today;
// the regex covers future point releases; the fallback never leaks the raw id.
const MODEL_LABELS = {
  "claude-opus-4-8": "Opus 4.8", "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-5": "Sonnet 4.5", "claude-haiku-4-5": "Haiku 4.5",
  "claude-fable-5": "Fable 5", "claude-fable-5-1": "Fable 5.1",
};
function modelLabel(raw) {
  if (!raw || raw === "<synthetic>") return "";
  if (MODEL_LABELS[raw]) return MODEL_LABELS[raw];
  // Optional trailing date stamp (claude-haiku-4-5-20251001) must not be read as a minor version.
  const m = raw.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/i);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1) + " " + m[2] + (m[3] ? "." + m[3] : "");
  return raw.replace(/^claude-/, "");
}
// One quiet "config" chip: what model + permission mode this session is running.
// A different axis from status, so it reads as metadata, not a signal.
function aiConfigChip(model, mode) {
  const ml = modelLabel(model);
  const modeLbl = mode ? (MODE_LABELS[mode] || (mode[0].toUpperCase() + mode.slice(1))) : "";
  if (!ml && !modeLbl) return "";
  const modeCls = mode && /^[a-zA-Z]+$/.test(mode) ? mode : "other";
  const title = [ml ? `Model: ${ml}` : "", modeLbl ? `Permission mode: ${modeLbl}` : ""].filter(Boolean).join(" · ");
  const modelPart = ml ? `<span class="ai-model">${esc(ml)}</span>` : "";
  const sep = ml && modeLbl ? `<span class="ai-sep"></span>` : "";
  const modePart = modeLbl ? `<span class="ai-mode mode-${modeCls}"><span class="ai-dot"></span>${esc(modeLbl)}</span>` : "";
  return `<span class="aiconfig" title="${esc(title)}">${modelPart}${sep}${modePart}</span>`;
}
function card(s) {
  const st = STATUS[s.status] || STATUS.closed;
  const who = s.lastRole === "assistant" ? "Claude" : "You";
  const pinned = state.pins.has(s.sessionId);
  return `
  <div class="card ${s.needsAttention ? "attention" : ""}" role="button" tabindex="0" data-id="${esc(s.sessionId)}" aria-label="${esc(s.title)} — ${st.label}">
    <div class="card-head">
      <div class="card-title">${esc(s.title)}</div>
      <button class="pin" data-pin="${esc(s.sessionId)}" aria-pressed="${pinned}" aria-label="${pinned ? "Unpin" : "Pin"} session">${starIcon(pinned)}</button>
    </div>
    <div class="card-sub">
      <span class="status ${st.cls}">${statusIcon(s.status)}${st.label}</span>
      ${aiConfigChip(s.model, s.permissionMode)}
      <span class="proj">${esc(s.project)}</span>
      ${s.gitBranch ? `<span class="meta">${svg("branch", "ic-sm")} ${esc(s.gitBranch)}</span>` : ""}
      <span class="meta">${s.messageCount} msg${s.messageCount === 1 ? "" : "s"}</span>
      <span class="meta time">${timeAgo(s.lastTs || s.mtimeMs)}</span>
    </div>
    ${s.lastMessage ? `<div class="card-preview"><span class="who">${who}:</span> ${esc(s.lastMessage)}</div>` : ""}
    ${footHTML(s)}
  </div>`;
}
function footHTML(s) {
  const hasUsage = s.tok5h || s.tokWeek;
  const queuedInd = s.queued
    ? (s.queueStuck
        ? `<span class="queued-ind stuck" title="Queue paused on a failed message — open to retry or remove it">${svg("alert", "ic-sm")} queue paused</span>`
        : `<span class="queued-ind" title="${s.queued} message${s.queued === 1 ? "" : "s"} queued to send">${svg("layers", "ic-sm")} ${s.queued} queued</span>`)
    : "";
  const actions = `${queuedInd}${s.pendingTool ? `<span class="tool">${svg("terminal", "ic-sm")} ${esc(s.pendingTool)}</span>` : ""}${s.status === "waiting" ? `<span class="needs">needs input</span>` : ""}${s.live && s.appLink ? `<a class="applink" href="${esc(s.appLink)}" title="Open this live session in the Claude app">${svg("external", "ic-sm")} open live</a>` : ""}`;
  if (!hasUsage && !actions) return "";
  const t = state.totals || { fiveHour: 0, week: 0 };
  const p5 = t.fiveHour ? Math.round((100 * (s.tok5h || 0)) / t.fiveHour) : 0;
  const pw = t.week ? Math.round((100 * (s.tokWeek || 0)) / t.week) : 0;
  const donuts = hasUsage ? `<div class="usage-share">
    ${donut(p5, "var(--work)", "5h", `${fmtTok(s.tok5h)} tokens — ${p5}% of your last-5h usage`)}
    ${donut(pw, "var(--accent)", "wk", `${fmtTok(s.tokWeek)} tokens — ${pw}% of your weekly usage`)}
  </div>` : "<span></span>";
  return `<div class="card-foot">${donuts}<span class="foot-actions">${actions}</span></div>`;
}
function donut(pct, color, label, title) {
  pct = Math.max(0, Math.min(100, pct || 0));
  const r = 10, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<div class="donut" title="${esc(title)}">
    <span class="donutring">
      <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true">
        <circle cx="13" cy="13" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="3"/>
        <circle cx="13" cy="13" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 13 13)"/>
      </svg>
      <span class="dpct">${pct}</span>
    </span>
    <span class="dlabel">${label}</span>
  </div>`;
}
function fmtTok(n) {
  n = n || 0;
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, "") + "k";
  return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
}
// Live "where are my tokens going" breakdown by project, from the same per-session
// token sums the cards use. Collapsible; refreshes on every poll. "5h"/"week" are
// CodeShelf's own accounting (new tokens, cache-reads excluded) — not the plan meter.
let sigByProj = "", byProjOpen = lsGet("ce-byproj", false);
function renderUsageByProject() {
  const el = $("#byProject"); if (!el) return;
  const byP = {};
  for (const s of state.sessions) {
    const p = s.project || "—";
    (byP[p] = byP[p] || { tok5h: 0, tokWeek: 0 });
    byP[p].tok5h += s.tok5h || 0; byP[p].tokWeek += s.tokWeek || 0;
  }
  const rows = Object.entries(byP).filter(([, v]) => v.tokWeek > 0 || v.tok5h > 0);
  if (!rows.length) { el.hidden = true; el.innerHTML = ""; sigByProj = ""; return; }
  el.hidden = false;
  const any5h = rows.some(([, v]) => v.tok5h > 0);
  rows.sort((a, b) => any5h ? (b[1].tok5h - a[1].tok5h) || (b[1].tokWeek - a[1].tokWeek) : b[1].tokWeek - a[1].tokWeek);
  const tot5 = rows.reduce((a, [, v]) => a + v.tok5h, 0);
  const totW = rows.reduce((a, [, v]) => a + v.tokWeek, 0);
  const maxW = Math.max(...rows.map(([, v]) => v.tokWeek), 1);
  const sig = JSON.stringify([byProjOpen, rows.map(([p, v]) => [p, v.tok5h, v.tokWeek])]);
  if (sig === sigByProj) return;
  sigByProj = sig;
  const head = `<button class="bp-head" id="byProjToggle" aria-expanded="${byProjOpen}" aria-controls="byProjList">${svg("caret", "ic-sm")}<span class="bp-title">Tokens by project</span><span class="bp-sum">5h <b>${fmtTok(tot5)}</b> · week <b>${fmtTok(totW)}</b></span></button>`;
  const body = byProjOpen ? `<div class="bp-list" id="byProjList">
      <div class="bp-row bp-colhead"><span class="bp-name"></span><span class="bp-bar" aria-hidden="true"></span><span class="bp-nums"><span class="bp-5h">5h</span><span class="bp-wk">week</span></span></div>
      ${rows.slice(0, 12).map(([p, v]) => {
        const w = Math.round((100 * v.tokWeek) / maxW);
        return `<div class="bp-row"><span class="bp-name" title="${esc(p)}">${esc(p)}</span><span class="bp-bar" aria-hidden="true"><span class="bp-fill" style="width:${w}%"></span></span><span class="bp-nums"><span class="bp-5h" title="last 5 hours">${v.tok5h ? fmtTok(v.tok5h) : "—"}</span><span class="bp-wk" title="this week">${fmtTok(v.tokWeek)}</span></span></div>`;
      }).join("")}</div>` : "";
  el.innerHTML = head + body;
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><span class="es-ic">${svg(icon, "ic")}</span><div class="es-title">${esc(title)}</div>${sub ? `<div class="es-sub">${esc(sub)}</div>` : ""}</div>`;
}
function renderError(title, msg, retry) {
  $("#content").innerHTML = `<div class="error-box"><div class="etitle">${esc(title)}</div><div class="emsg">${esc(msg || "")}</div><button class="btn primary" id="retryBtn">Try again</button></div>`;
  $("#retryBtn")?.addEventListener("click", retry);
}

// ---------------------------------------------------------------------------
// Usage panel
// ---------------------------------------------------------------------------
async function loadUsage() {
  try { renderUsage(await api("/api/usage")); } catch {}
}
function renderUsage(u) {
  const box = $("#usage");
  state.lastUsage = u;
  if (!u || !u.available) { box.innerHTML = `<div class="ucard muted" style="grid-column:1/-1">Plan usage history isn't available to read on this machine.</div>`; return; }
  box.innerHTML = gauge("5-hour limit", u.fiveHour, "var(--work)", "var(--work-dot)", usageSub(u, u.fiveHour), state.budgets.fiveHourPct)
    + gauge("Weekly limit", u.weekly, "var(--accent-2)", "var(--accent)", usageSub(u, u.weekly), state.budgets.weeklyPct);
}
// "resets in 31m" / "resets in 2d 1h" — the countdown to a limit window's reset.
function fmtResetIn(ts) {
  const ms = ts - Date.now();
  if (!(ms > 0)) return "resetting now";
  const m = Math.round(ms / 60000);
  if (m < 60) return "resets in " + Math.max(1, m) + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return "resets in " + h + "h" + (m % 60 ? " " + (m % 60) + "m" : "");
  const d = Math.floor(h / 24);
  return "resets in " + d + "d" + (h % 24 ? " " + (h % 24) + "h" : "");
}
// Live reading → the window's reset countdown. A stale/fallback reading says so, since
// a number that is hours old (or from the app's history file) can be well off.
function usageSub(u, d) {
  if (u.live) return d.resetsAt ? fmtResetIn(d.resetsAt) : "live";
  return (u.updatedAt ? "last read " + timeAgo(u.updatedAt) : "not live") + " · may be out of date";
}
// `cap` is an optional budget (% of plan limit). When set, the gauge shows a target
// marker and turns urgent + "over budget" once usage reaches it.
function gauge(label, d, strong, soft, upd, cap = 0) {
  const pct = Math.round(d.current || 0);
  const over = cap > 0 && pct >= cap;
  const col = over || pct >= 90 ? "var(--urgent)" : strong;
  const dot = over || pct >= 90 ? "var(--urgent)" : soft;
  const marker = cap > 0 ? `<div class="ucap" style="left:${Math.min(100, cap)}%" title="Budget: ${cap}%"></div>` : "";
  const budgetNote = cap > 0
    ? (over ? `<span class="ubudget over">${svg("alert", "ic-sm")} over budget (${cap}%)</span>` : `<span class="ubudget">budget ${cap}%</span>`)
    : "";
  return `<div class="ucard" style="--uc:${col}" aria-label="${label}: ${pct}% used${cap ? `, budget ${cap}%${over ? " — over budget" : ""}` : ""}">
    <div class="uinfo">
      <div class="ulabel"><span class="led" style="background:${dot}"></span>${label}${budgetNote}</div>
      <div class="urow"><span class="upct">${pct}%</span><span class="usub">${upd}</span></div>
      <div class="ubar">${marker}<div class="ufill" style="width:${Math.min(100, pct)}%"></div></div>
    </div>
    <div class="uspark" role="img" aria-label="${label} trend">${sparkline(d.series, col)}</div>
  </div>`;
}
function sparkline(series, color) {
  const W = 128, H = 44, pad = 3;
  if (!series || series.length < 2) return "";
  const xs = (i) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const ys = (v) => H - pad - (Math.max(0, Math.min(100, v)) / 100) * (H - 2 * pad);
  const pts = series.map((s, i) => `${xs(i).toFixed(1)},${ys(s.v).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const area = line + ` L${xs(series.length - 1).toFixed(1)},${H - pad} L${xs(0).toFixed(1)},${H - pad} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${area}" fill="${color}" opacity="0.12"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
let searchTimer = null;
function onSearch(v) {
  state.search = v.trim();
  clearTimeout(searchTimer);
  if (!state.search) { sigContent = ""; renderContent(); return; }
  searchTimer = setTimeout(runSearch, 280);
}
async function runSearch() {
  const q = state.search;
  $("#content").innerHTML = `<div class="empty"><span class="spinner"></span> Searching…</div>`;
  try {
    const data = await api("/api/search?q=" + encodeURIComponent(q));
    if (state.search !== q) return;
    const r = data.results || [];
    if (!r.length) { $("#content").innerHTML = emptyState("search", "No matches", `Nothing matches “${q}”. Try a shorter or different term.`); return; }
    $("#content").innerHTML = `<section class="group"><h2 class="group-head"><span class="led" style="background:var(--accent)"></span>${r.length} result${r.length === 1 ? "" : "s"} for “${esc(q)}”</h2><div class="cards">${r.map(searchCard).join("")}</div></section>`;
  } catch (e) { renderError("Search failed", e.message, runSearch); }
}
function searchCard(s) {
  const st = STATUS[s.status] || STATUS.closed;
  return `<div class="card" role="button" tabindex="0" data-id="${esc(s.sessionId)}" aria-label="${esc(s.title)}">
    <div class="card-head"><div class="card-title">${esc(s.title)}</div><span class="status ${st.cls}">${statusIcon(s.status)}${st.label}</span></div>
    <div class="card-sub"><span class="proj">${esc(s.project)}</span><span class="meta">${timeAgo(s.lastTs || s.mtimeMs)}</span></div>
    <div class="card-preview">${highlight(s.snippet, state.search)}</div></div>`;
}

// ---------------------------------------------------------------------------
// Conversation drawer
// ---------------------------------------------------------------------------
let openSeq = 0;
const convo = { id: null, live: false, lastTs: null, uuids: new Set(), messages: [], msgView: "all", data: null };
let lastFocus = null;
let sending = false;

const msgVisible = (m) => convo.msgView === "all" || m.human;

async function openSession(id) {
  const seq = ++openSeq;
  lastFocus = document.activeElement;
  $("#drawer").hidden = false;
  $("#drawerBackdrop").hidden = false;
  document.body.classList.add("locked");
  pendingAttach = [];
  $("#messages").innerHTML = `<div class="empty"><span class="spinner"></span> Loading…</div>`;
  $("#convoTitle").textContent = "…"; $("#convoMeta").textContent = ""; $("#composer").innerHTML = ""; $("#msgFilter").innerHTML = "";
  markOpenCard(id);
  try {
    const c = await api("/api/sessions/" + encodeURIComponent(id));
    if (seq !== openSeq) return;
    convo.id = id; convo.live = c.live; convo.lastTs = c.lastTs; convo.data = c;
    convo.messages = c.messages; convo.uuids = new Set(c.messages.map((m) => m.uuid));
    convo.queue = c.queue || [];
    convo.bootId = c.bootId;
    $("#convoTitle").textContent = c.title;
    updateConvoHeader(c); renderMsgFilter(); renderMessages(true); renderComposer(c);
    $("#drawerClose").focus();
    loadMeta();
  } catch (e) {
    if (seq !== openSeq) return;
    $("#messages").innerHTML = `<div class="error-box"><div class="etitle">Couldn't load</div><div class="emsg">${esc(e.message)}</div></div>`;
  }
}
const fetchConvo = (id) => api("/api/sessions/" + encodeURIComponent(id));
// Append any messages we haven't shown yet; returns how many arrived.
function appendNew(c) {
  if (!c || c.sessionId !== convo.id) return 0;
  // The queue persists across restarts, so a bootId change normally recovers it.
  // Only if it came back empty despite us having had items did persistence fail —
  // then offer to restore from what the client still holds.
  if (convo.bootId && c.bootId && c.bootId !== convo.bootId && convo.queue?.length && !(c.queue && c.queue.length)) {
    const lost = convo.queue.slice();
    toastAction("Queued messages were lost on restart", "Restore", () => {
      lost.forEach((it) => postQueue(convo.data, it.text, it.model || "", it.effort || "", it.mode || ""));
    }, "err");
  }
  if (c.bootId) convo.bootId = c.bootId;
  convo.data = c;
  convo.queue = c.queue || [];
  renderQueue();
  // If a queued send failed on auth, refresh meta so the login banner appears (the
  // direct-send path gets this; the queue drains server-side, so pull it in here).
  if (meta.loggedIn && (convo.queue || []).some((it) => it.status === "error" && /not logged in|sign ?in|credential|unauthor|auth/i.test(it.error || ""))) loadMeta();
  updateConvoHeader(c);
  const box = $("#messages");
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 100;
  const fresh = c.messages.filter((m) => !convo.uuids.has(m.uuid));
  if (fresh.length) {
    convo.messages.push(...fresh);
    const visFresh = fresh.filter(msgVisible);
    if (visFresh.length) {
      if (c.truncated && fresh.length === c.messages.length) renderMessages(false);
      else { box.insertAdjacentHTML("beforeend", visFresh.map(renderMessage).join("")); wireTools(box); }
      if (near) box.scrollTop = box.scrollHeight;
    }
    for (const m of c.messages) convo.uuids.add(m.uuid);
  }
  convo.lastTs = c.lastTs;
  return fresh.length;
}
async function refreshOpenSession() {
  if (!convo.id || document.hidden || sending) return;
  if (!convo.live && !(convo.queue && convo.queue.length)) return;
  try {
    const c = await fetchConvo(convo.id);
    appendNew(c);
    if (c.live !== convo.live) { convo.live = c.live; }
  } catch {}
}
function updateConvoHeader(c) {
  const st = STATUS[c.status] || STATUS.closed;
  const other = state.sessions.find((x) => x.sessionId === c.sessionId);
  const mode = c.permissionMode || other?.permissionMode;
  const model = c.model || other?.model;
  $("#convoMeta").innerHTML = `<span class="proj">${esc(c.project)}</span><span class="status ${st.cls}" style="font-size:10px">${statusIcon(c.status)}${st.label}</span>${aiConfigChip(model, mode)}<span class="meta" style="font-family:var(--mono)">${c.totalMessages} messages</span>${c.truncated ? `<span>showing last ${c.returnedMessages}</span>` : ""}`;
  syncPrimary(c);
}
function renderMsgFilter() {
  $("#msgFilter").innerHTML =
    `<button data-view="all" aria-pressed="${convo.msgView === "all"}">${svg("layers", "ic-sm")} All</button>` +
    `<button data-view="mine" aria-pressed="${convo.msgView === "mine"}">${svg("user", "ic-sm")} Mine</button>`;
}
function renderMessages(resetScroll) {
  const box = $("#messages");
  const vis = convo.messages.filter(msgVisible);
  box.innerHTML = vis.length
    ? vis.map(renderMessage).join("")
    : `<div class="empty">${convo.msgView === "mine" ? "You haven't sent any messages in this session yet." : "No messages."}</div>`;
  wireTools(box);
  if (resetScroll) box.scrollTop = box.scrollHeight;
}
function wireTools(box) {
  $$(".collapsed-tools", box).forEach((el) => {
    if (el.dataset.wired) return; el.dataset.wired = "1";
    el.addEventListener("click", () => {
      const body = el.nextElementSibling; const show = body.hidden;
      body.hidden = !show; el.setAttribute("aria-expanded", String(show));
      $(".ct-label", el).textContent = show ? "hide tool steps" : el.dataset.label;
    });
  });
}
function renderMessage(m) {
  if (m.onlyToolResults) {
    const label = `${m.blocks.length} tool result${m.blocks.length === 1 ? "" : "s"}`;
    return `<div class="msg"><button class="collapsed-tools" data-label="${label}" aria-expanded="false">${svg("chevron", "ic-sm")}<span class="ct-label">${label}</span></button><div hidden>${m.blocks.map(renderBlock).join("")}</div></div>`;
  }
  const roleLabel = m.role === "user" ? "You" : "Claude";
  const time = m.ts ? new Date(m.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const textBlocks = m.blocks.filter((b) => b.type === "text");
  const other = m.blocks.filter((b) => b.type !== "text");
  let body = "";
  if (textBlocks.length) body += `<div class="bubble text md">${md(textBlocks.map((b) => b.text).join("\n\n"))}</div>`;
  if (other.length) body += other.map(renderBlock).join("");
  return `<div class="msg ${m.role}"><div class="role">${roleLabel} <span style="color:var(--text-3)">${time}</span></div>${body}</div>`;
}
function renderBlock(b) {
  if (b.type === "text") return `<div class="bubble text md">${md(b.text)}</div>`;
  if (b.type === "thinking") return `<div class="block-thinking">${esc(b.text)}</div>`;
  if (b.type === "tool_use") return `<div class="block-tool">${svg("terminal", "ic-sm")}<span><span class="tname">${esc(b.name)}</span>${b.summary ? " " + esc(b.summary) : ""}</span></div>`;
  if (b.type === "tool_result") return `<div class="block-tool result ${b.isError ? "err" : ""}">${svg("result", "ic-sm")}<span>${esc(b.text || "(no output)")}</span></div>`;
  if (b.type === "image") return `<div class="tool-note">${svg("image", "ic-sm")} image</div>`;
  return "";
}

function renderComposer(c) {
  const el = $("#composer");
  // Preserve a draft across re-renders (auth-state changes rebuild the composer):
  // losing what someone is typing is the worst break for a reply tool.
  const prevTa = $("#composerText");
  const prevVal = prevTa ? prevTa.value : "";
  const prevStart = prevTa ? prevTa.selectionStart : null;
  const prevEnd = prevTa ? prevTa.selectionEnd : null;
  const chosen = lsGet("ce-model", "");
  const eff = Math.max(0, Math.min(5, lsGet("ce-effort", 0)));
  const uc = !!lsGet("ce-ultracode", false);
  const sessMode = state.sessions.find((x) => x.sessionId === c.sessionId)?.permissionMode || "";
  const curMode = PMODES.some((m) => m.v === sessMode) ? sessMode : "";
  // Live-window typing uses macOS GUI automation, so offer it only on macOS.
  const liveBot = c.live && !!c.appLink && meta.platform !== "win32" && meta.platform !== "linux";
  // A live-window session types into the already-signed-in desktop app, so it needs
  // no CLI login — don't nag about one. The banner is only for the headless path.
  const authNote = (!meta.loggedIn && !liveBot) ? authNoteHTML() : "";
  const liveNote = liveBot
    ? `<div class="live-note">${svg("activity", "ic-sm")}<span class="ln-main">Typed into the live Claude window — syncs to Remote Control &amp; phone, and the reply streams in here. Claude briefly comes forward, then focus returns to your window.</span><button type="button" class="applink ln-toggle" id="liveDetailsBtn" aria-expanded="false" aria-controls="liveMore">Details</button><div class="ln-more" id="liveMore" hidden>First use asks for macOS Accessibility permission (once). Attachments can't be typed in — <button type="button" class="applink" id="headlessLink" title="Run the reply as a separate headless turn instead">send a separate turn here</button> for those${meta.rcUrl ? ` · <a class="applink" href="${esc(meta.rcUrl)}" target="_blank" rel="noopener">Remote Control ↗</a>` : ""}.</div></div>`
    : (c.live && meta.loggedIn)
      ? `<div class="live-note">${svg("activity", "ic-sm")}<span class="ln-main">Your reply runs as its own turn and shows up below.</span>${meta.rcUrl ? `<a class="applink" href="${esc(meta.rcUrl)}" target="_blank" rel="noopener">Remote Control ↗</a>` : ""}</div>`
      : "";
  el.innerHTML = `${authNote}${liveNote}
    <div class="composer-shell">
      <div class="queue-panel" id="queuePanel" hidden></div>
      <div class="queue-hint" id="queueHint" hidden></div>
      <textarea id="composerText" placeholder="Reply to this session…  (Enter sends · Shift+Enter for a new line · paste or drop images)"></textarea>
    </div>
    <div class="attach-row" id="attachRow" hidden></div>
    <div class="composer-controls">
      <button class="cbtn" id="attachBtn" type="button" aria-label="Attach image or file" title="Attach image / file">${svg("paperclip", "ic-sm")}</button>
      <button class="cbtn" id="micBtn" type="button" aria-pressed="false" aria-label="Dictate (voice to text)" title="Dictate — voice to text">${svg("mic", "ic-sm")}</button>
      <div class="pop-wrap">
        <button class="turn-settings" id="turnBtn" type="button" aria-haspopup="true" aria-expanded="false" title="Model, mode & effort for your reply">${svg("sliders", "ic-sm")}<span class="ts-sum" id="tsSummary"></span>${svg("caret", "ic-sm")}</button>
        <div class="settings-pop" id="settingsPop" role="group" aria-label="Reply settings" hidden>
          <label class="sp-row"><span class="sp-lbl">Model</span><select class="model-select" id="modelSelect">${modelOptionsHTML(chosen)}</select></label>
          <label class="sp-row"><span class="sp-lbl">Permission mode</span><select class="model-select" id="modeSelect" title="Switches the session's mode when sent">${PMODES.map((m) => `<option value="${m.v}" ${m.v === curMode ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
          <label class="sp-row"><span class="sp-lbl">Effort · <span class="elabel" id="effortLabel">${EFFORT_LABELS[eff]}</span></span><input type="range" id="effortRange" min="0" max="5" step="1" value="${eff}" aria-label="Reasoning effort" aria-valuetext="${EFFORT_LABELS[eff]}"></label>
          <label class="sp-row sp-switch"><span class="sp-lbl">Ultracode <span class="sp-sub">adds the <code>ultracode</code> keyword — Workflow-tool mode, xhigh effort</span></span><input type="checkbox" id="ultracodeToggle" ${uc ? "checked" : ""} aria-label="Ultracode mode"></label>
        </div>
      </div>
      <span class="grow"></span>
      <button class="btn stop" id="stopBtn" type="button" hidden title="Interrupt the running turn (sends Escape to the live window)">${svg("stop", "ic-sm")} Stop</button>
      <div class="send-split">
        <button class="btn primary" id="sendBtn" type="button" data-sendlabel="${liveBot ? "Send to live window" : "Send reply"}">${liveBot ? "Send to live window" : "Send reply"}</button>
        <button class="btn primary caret" id="primaryMore" type="button" aria-haspopup="true" aria-expanded="false" aria-label="More send options">${svg("caret", "ic-sm")}</button>
        <div class="send-menu" id="sendMenu" role="menu" hidden></div>
      </div>
    </div>
    <input type="file" id="attachInput" multiple style="display:none" accept="image/*,.pdf,.txt,.md,.csv,.json,.log" />`;
  $("#liveDetailsBtn")?.addEventListener("click", () => {
    const more = $("#liveMore"), b = $("#liveDetailsBtn"); if (!more) return;
    const show = more.hidden; more.hidden = !show; b.setAttribute("aria-expanded", String(show)); b.textContent = show ? "Hide" : "Details";
  });
  $("#headlessLink")?.addEventListener("click", () => sendNow(c)); // headless fallback (files, or if the bot fails)
  $("#modelSelect").addEventListener("change", (e) => { lsSet("ce-model", e.target.value); updateTurnSummary(); });
  $("#modeSelect").addEventListener("change", updateTurnSummary);
  const range = $("#effortRange");
  range.addEventListener("input", (e) => {
    const i = Number(e.target.value); lsSet("ce-effort", i);
    $("#effortLabel").textContent = EFFORT_LABELS[i]; range.setAttribute("aria-valuetext", EFFORT_LABELS[i]); updateTurnSummary();
  });
  $("#ultracodeToggle")?.addEventListener("change", (e) => { lsSet("ce-ultracode", e.target.checked); updateTurnSummary(); });
  $("#turnBtn").addEventListener("click", () => togglePopover($("#turnBtn"), $("#settingsPop")));
  $("#primaryMore").addEventListener("click", openSendMenu);
  $("#attachBtn").addEventListener("click", () => $("#attachInput").click());
  $("#attachInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  $("#micBtn").addEventListener("click", toggleMic);
  const ta = $("#composerText");
  // Enter triggers the primary action, which adapts to status: Queue while Claude
  // is working, Send otherwise. Shift+Enter inserts a newline. No confirmation.
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); doPrimary(); } });
  ta.addEventListener("paste", (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); addFiles(imgs.map((it) => it.getAsFile()).filter(Boolean)); }
  });
  // #composer is a static element (not replaced by innerHTML), so bind its
  // container-level drag/drop ONCE — re-binding every render leaked handlers and
  // made a dropped file upload N times.
  if (!el.dataset.dndWired) {
    el.dataset.dndWired = "1";
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("dragging"); });
    el.addEventListener("dragleave", (e) => { if (e.target === el) el.classList.remove("dragging"); });
    el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("dragging"); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  }
  $("#sendBtn").addEventListener("click", doPrimary);
  $("#stopBtn").addEventListener("click", () => stopLive(c));
  // Restore any draft the previous composer held (and the caret position).
  if (prevVal) { ta.value = prevVal; if (prevStart != null) { try { ta.setSelectionRange(prevStart, prevEnd); } catch {} } }
  updateTurnSummary();
  syncPrimary(c);
  renderAttachRow();
  renderQueue();
  setTimeout(() => ta.focus(), 20);
}
// The primary action adapts to the session's state so the user never has to
// choose "queue vs send": it reads "Queue" whenever sending now would collide —
// Claude is mid-turn, OR earlier queued messages are still draining — and only
// becomes "Send" once the session is free AND the queue is empty.
function isLiveBot(c) { return !!(c && c.live && c.appLink && meta.platform !== "win32" && meta.platform !== "linux"); }
// Any message still waiting, in flight, OR parked on an error — sending a new one
// now would jump ahead of it, so the primary stays "Queue" and new messages park.
function queueActive() { return (convo.queue || []).some((it) => it.status === "queued" || it.status === "sending" || it.status === "error"); }
function shouldQueue(c) { return !!(c && (c.status === "working" || queueActive())); }
function doPrimary() {
  const c = convo.data; if (!c) return;
  if (shouldQueue(c)) queueNow(c);
  else isLiveBot(c) ? sendToLiveWindow(c) : sendNow(c);
}
// The overflow "Send this draft now" escape hatch — send the drafted text even
// though it interrupts the turn / jumps the queue. No-op guard lives in sendNow.
function forceSend() {
  const c = convo.data; if (!c) return;
  if (!($("#composerText")?.value || "").trim()) { toast("Type a message in the box first"); return; }
  isLiveBot(c) ? sendToLiveWindow(c) : sendNow(c);
}
// Flip the primary button, its overflow menu, and the "why Queue?" hint to match
// state. Called on open and on every poll, so when the turn ends (and the queue
// drains) the button reverts to Send on its own and Enter's meaning follows.
function syncPrimary(c) {
  const pb = $("#sendBtn"), menu = $("#sendMenu"), more = $("#primaryMore"); if (!pb) return;
  if (sending || liveSending) return; // don't stomp the in-progress spinner/label
  const sendLabel = isLiveBot(c) ? "Send to live window" : "Send reply";
  pb.dataset.sendlabel = sendLabel;
  const working = !!(c && c.status === "working");
  const qActive = queueActive();
  const qStuck = (convo.queue || []).some((it) => it.status === "error");
  // Stop only applies to a live window we can reach (Escape is typed into the app);
  // a headless turn is a separate process, so there's nothing to Escape there.
  const stopBtn = $("#stopBtn");
  if (stopBtn && !liveStopping) stopBtn.hidden = !(working && isLiveBot(c));
  const hint = $("#queueHint");
  if (working || qActive) {
    pb.innerHTML = `${svg("layers", "ic-sm")} Queue`;
    // A paused (failed-head) queue takes precedence: a new message won't send "when
    // the turn finishes" — it's blocked behind the failed one until that's resolved.
    pb.title = qStuck
      ? "The queue is paused on a failed message — yours queues behind it and sends after you retry or remove that one"
      : working
        ? (isLiveBot(c)
            ? "Claude is working — your message is queued and typed into the live window (with any model switch) once this turn finishes"
            : "Claude is working — your message is queued and sent when the turn finishes")
        : "Earlier messages are still sending — yours is queued after them";
    // Escape hatch: send the draft as its own turn right now instead of queuing.
    if (menu) menu.innerHTML = `<button class="menu-item warn" data-sendnow type="button" role="menuitem" title="Sends this draft as its own turn right now, skipping the queue — if Claude is mid-turn it can overlap that turn">${svg("alert", "ic-sm")} Send this draft now (skip the queue)</button>`;
    if (more) more.hidden = false;
  } else {
    pb.textContent = sendLabel;
    pb.title = "";
    if (menu) menu.innerHTML = ""; // nothing worth queuing-for-later when the session is free
    if (more) more.hidden = true;  // hide the caret so the button reads as one solid action
  }
  $(".send-split")?.classList.toggle("solo", !!(more && more.hidden));
  // One-line explanation of why the button says "Queue", shown only when the box
  // is the next thing you'd act on (working, nothing queued yet).
  // Show the "why Queue?" hint whenever the box is the next thing to act on (working,
  // nothing queued yet) — including live sessions, since that's the default state.
  // Suppress it only when the auth banner is already up, to avoid a 3rd stacked note.
  if (hint) {
    const show = working && !qActive && meta.loggedIn;
    hint.hidden = !show;
    if (show) hint.innerHTML = `${svg("activity", "ic-sm")} Claude is working — messages queue and send when the turn finishes.`;
  }
}
function updateTurnSummary() {
  const sum = $("#tsSummary"); if (!sum) return;
  const mv = $("#modelSelect")?.value || "";
  const md = $("#modeSelect")?.value || "";
  const ef = Number($("#effortRange")?.value || 0);
  const parts = [mv ? (MODELS.find((m) => m.v === mv)?.label || mv) : "Default"];
  if (md) parts.push(MODE_LABELS[md] || md);
  if (ef) parts.push(EFFORT_LABELS[ef]);
  if ($("#ultracodeToggle")?.checked) parts.push("Ultracode");
  sum.textContent = parts.join(" · ");
}
// When Ultracode is on, include the keyword so Claude Code opts this turn into its
// Workflow tool (the real, default-on trigger) — the same mechanism as typing it.
function applyUltracode(text) {
  return $("#ultracodeToggle")?.checked ? `${text}\n\nultracode` : text;
}
function closeComposerPopovers() {
  $$(".settings-pop, .send-menu").forEach((p) => { p.hidden = true; });
  $("#turnBtn")?.setAttribute("aria-expanded", "false");
  $("#primaryMore")?.setAttribute("aria-expanded", "false");
}
function togglePopover(btn, pop) {
  const show = pop.hidden; closeComposerPopovers();
  pop.hidden = !show; btn.setAttribute("aria-expanded", String(show));
}
// Opening the send menu: grey out "Send this draft now" when the box is empty,
// so it never looks like it'll flush the queue (it only sends typed text).
function openSendMenu() {
  const menu = $("#sendMenu");
  const sn = menu?.querySelector("[data-sendnow]");
  if (sn) {
    const empty = !($("#composerText")?.value || "").trim();
    sn.disabled = empty;
    sn.classList.toggle("is-disabled", empty);
    sn.title = empty ? "Type a message in the box to send it now" : "Sends this draft as its own turn right now, skipping the queue — if Claude is mid-turn it can overlap that turn";
  }
  togglePopover($("#primaryMore"), menu);
}
// "Edit" a queued message = pull it back into the box. Only populate the box if
// the item was actually removed, so a failed/ in-flight dequeue can't leave the
// same text in both the queue and the composer (a duplicate-send trap).
async function editQueued(id) {
  const it = (convo.queue || []).find((x) => x.id === id); if (!it) return;
  const ta = $("#composerText");
  if (ta && ta.value.trim()) { toast("Finish or clear your draft first — the box already holds unsent text", "err"); return; }
  const ok = await dequeue(id);
  if (ok && ta) { ta.value = it.text; ta.focus(); }
}

// ---- Prompt queue ----
// Messages you line up while Claude is mid-turn; the server holds each one until
// the live turn finishes, then sends them in order — so Claude is never interrupted.
async function postQueue(c, text, model, effort, mode) {
  try {
    const r = await fetch("/api/sessions/" + encodeURIComponent(c.sessionId) + "/queue", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, model, effort, mode }),
    });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { convo.queue = data.queue || []; renderQueue(); syncPrimary(convo.data); }
    return data;
  } catch (e) { return { ok: false, message: e.message || "Couldn't queue" }; }
}
async function queueNow(c) {
  const ta = $("#composerText");
  const text = (ta?.value || "").trim();
  if (pendingAttach.length) { toast('Attachments can’t be queued. Remove them to queue, or use “Send this draft now” to include them.', "err"); return; }
  if (!text) { toast("Type a message to queue"); return; }
  const model = $("#modelSelect")?.value || "";
  const effort = EFFORT_VALUES[Number($("#effortRange")?.value || 0)] || "";
  const mode = $("#modeSelect")?.value || "";
  if (ta) ta.value = "";
  const data = await postQueue(c, applyUltracode(text), model, effort, mode);
  if (data.ok) toast(c.status === "working" ? "Queued — sends when the turn finishes" : "Queued — sending now", "ok");
  else { if (ta) ta.value = text; toast(data.message || "Couldn't queue", "err"); }
}
// A per-item chip when this message was queued with non-default settings, so a
// message set to a different model/mode/effort doesn't look identical to the rest.
function queueItemCfg(it) {
  const parts = [];
  if (it.model) parts.push(modelLabel(it.model) || it.model);
  if (it.mode) parts.push(MODE_LABELS[it.mode] || it.mode);
  if (it.effort) { const i = EFFORT_VALUES.indexOf(it.effort); if (i > 0) parts.push(EFFORT_LABELS[i]); }
  return parts.length ? `<span class="qcfg">${parts.map(esc).join(" · ")}</span>` : "";
}
// Expand/collapse a clamped queued message, remembering the choice in convo so a
// poll re-render doesn't re-collapse it (and keeping aria-expanded in sync).
function toggleQueueExpand(el) {
  const id = el.dataset.qid;
  if (!convo.expandedQueue) convo.expandedQueue = new Set();
  const nowExpanded = !el.classList.contains("expanded");
  el.classList.toggle("expanded", nowExpanded);
  el.classList.remove("is-clamped");
  el.setAttribute("aria-expanded", String(nowExpanded));
  if (id) { nowExpanded ? convo.expandedQueue.add(id) : convo.expandedQueue.delete(id); }
}
function renderQueue() {
  const panel = $("#queuePanel"); if (!panel) return;
  const q = convo.queue || [];
  panel.hidden = q.length === 0;
  if (!q.length) { panel.innerHTML = ""; return; }
  const isSending = q.some((it) => it.status === "sending");
  const waiting = q.filter((it) => it.status === "queued").length;
  const failed = q.filter((it) => it.status === "error").length;
  // One consistent frame: a failure pauses the whole queue and says so; otherwise
  // report what's happening now (sending) or that everything is waiting for the turn.
  const working = convo.data?.status === "working";
  let head;
  if (failed) head = `<span class="qh-fail">${svg("alert", "ic-sm")} Queue paused — ${failed} failed, ${waiting} waiting</span>`;
  else if (isSending) head = `<span class="spinner"></span> Sending now${waiting ? ` · ${waiting} waiting` : ""}`;
  // "when the turn finishes" is only true while Claude is actually working; idle +
  // queued means the server is draining them right now, so say that instead.
  else head = `${svg("layers", "ic-sm")} ${q.length} queued · ${working ? "sends when the turn finishes" : "sending in order…"}`;
  // For a live (macOS) session, queued items are typed into the live window once the
  // current turn finishes — including any model switch — so they land on the desktop
  // app, not as a separate headless CLI turn. State that in the panel.
  const liveNote = isLiveBot(convo.data) ? `<div class="queue-subnote">Queued messages are typed into the live window when the turn finishes — model switches apply on the desktop app.</div>` : "";
  panel.innerHTML = `<div class="queue-head" role="status" aria-live="polite">${head}</div>${liveNote}` +
    q.map((it, i) => {
      const st = it.status || "queued";
      const num = st === "sending" ? `<span class="spinner"></span>`
        : st === "error" ? svg("alert", "ic-sm") : `${i + 1}`;
      let ctl;
      if (st === "sending") ctl = `<span class="qmark">sending…</span>`;
      else {
        const retry = st === "error" ? `<button class="qx qretry" data-requeue="${esc(it.id)}" aria-label="Retry this message" title="Retry">${svg("refresh", "ic-sm")}</button>` : "";
        const edit = `<button class="qx" data-edit="${esc(it.id)}" aria-label="Edit — pull back into the box" title="Edit">${svg("pencil", "ic-sm")}</button>`;
        const remove = `<button class="qx qdestroy" data-dequeue="${esc(it.id)}" aria-label="Remove and discard" title="Remove and discard">${svg("x", "ic-sm")}</button>`;
        ctl = retry + edit + remove;
      }
      const reason = st === "error" && it.error
        ? `<div class="qreason">${esc(it.error)} <span class="qreason-hint">— fix it and retry, or remove to resume the rest.</span></div>`
        : "";
      const expanded = convo.expandedQueue?.has(it.id);
      return `<div class="queue-item q-${st}">
        <span class="qn">${num}</span>
        <div class="qbody">
          <div class="qtext clamp${expanded ? " expanded" : ""}" data-qid="${esc(it.id)}" tabindex="0" role="button" aria-expanded="${!!expanded}" title="Expand / collapse message">${esc(it.text)}</div>
          ${queueItemCfg(it)}
          ${reason}
        </div>
        <span class="qctl">${ctl}</span>
      </div>`;
    }).join("");
  // Reveal the expand affordance only on rows whose text is actually clamped.
  requestAnimationFrame(() => {
    $$(".queue-item .qtext.clamp", panel).forEach((el) => {
      if (!el.classList.contains("expanded") && el.scrollHeight - el.clientHeight > 2) el.classList.add("is-clamped");
    });
  });
}
async function dequeue(itemId) {
  if (!convo.id) return false;
  try {
    const r = await fetch("/api/sessions/" + encodeURIComponent(convo.id) + "/dequeue", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { convo.queue = data.queue || []; renderQueue(); syncPrimary(convo.data); return true; }
    toast(data.message || "Couldn't remove", "err"); return false;
  } catch (e) { toast(e.message || "Couldn't remove", "err"); return false; }
}
// Remove from the × control: discards the message, but offers a one-tap Undo so a
// mis-click never loses typed work (Edit preserves text; × is the destructive one).
// Removals within the Undo window accumulate, so rapid removes all come back together
// instead of each toast clobbering the previous one's Undo.
let undoBuffer = [], undoTimer = null;
async function removeQueued(id) {
  const it = (convo.queue || []).find((x) => x.id === id);
  const ok = await dequeue(id);
  if (!ok || !it) return;
  undoBuffer.push(it);
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { undoBuffer = []; }, 7000);
  const n = undoBuffer.length;
  toastAction(n === 1 ? "Removed from queue" : `${n} removed from queue`, "Undo", () => {
    clearTimeout(undoTimer);
    const items = undoBuffer; undoBuffer = [];
    items.forEach((x) => postQueue(convo.data, x.text, x.model || "", x.effort || "", x.mode || ""));
  });
}
async function requeueItem(id) {
  if (!convo.id) return;
  try {
    const r = await fetch("/api/sessions/" + encodeURIComponent(convo.id) + "/requeue", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id }),
    });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { convo.queue = data.queue || []; renderQueue(); syncPrimary(convo.data); toast("Retrying…", "ok"); }
    else toast(data.message || "Couldn't retry", "err");
  } catch (e) { toast(e.message || "Couldn't retry", "err"); }
}

// ---- Attachments ----
let pendingAttach = [];
function fileToDataURL(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }
async function addFiles(files) {
  for (const f of [...files].slice(0, 10)) {
    if (f.size > 10 * 1024 * 1024) { toast(`${f.name} is over 10MB`, "err"); continue; }
    const item = { name: f.name, path: null, uploading: true, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null };
    pendingAttach.push(item); renderAttachRow();
    try {
      const data = await fileToDataURL(f);
      const r = await fetch("/api/upload", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, data }) });
      const j = await r.json();
      if (j.ok) { item.path = j.path; item.uploading = false; }
      else { toast(j.message || "Upload failed", "err"); pendingAttach = pendingAttach.filter((x) => x !== item); }
    } catch { toast("Upload failed", "err"); pendingAttach = pendingAttach.filter((x) => x !== item); }
    renderAttachRow();
  }
}
function renderAttachRow() {
  const row = $("#attachRow"); if (!row) return;
  row.hidden = pendingAttach.length === 0;
  row.innerHTML = pendingAttach.map((a, i) => `<span class="attach-chip">${a.url ? `<img src="${a.url}" alt="">` : svg("paperclip", "ic-sm")}<span class="an">${esc(a.name)}</span>${a.uploading ? `<span class="spinner"></span>` : `<button class="attach-x" data-attach-remove="${i}" aria-label="Remove ${esc(a.name)}">${svg("x", "ic-sm")}</button>`}</span>`).join("");
}

// ---- Voice to text ----
let recog = null, recActive = false;
function toggleMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice input isn't supported in this browser", "err"); return; }
  if (recActive) { try { recog.stop(); } catch {} return; }
  recog = new SR(); recog.lang = "en-US"; recog.interimResults = true; recog.continuous = true;
  const ta = $("#composerText"); const base = ta.value ? ta.value.replace(/\s+$/, "") + " " : "";
  recog.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; ta.value = (base + t).trimStart(); };
  const stop = () => { recActive = false; $("#micBtn")?.setAttribute("aria-pressed", "false"); };
  recog.onend = stop;
  recog.onerror = (e) => { stop(); if (e.error !== "aborted") toast("Couldn't hear you — check mic permission", "err"); };
  try { recog.start(); recActive = true; $("#micBtn")?.setAttribute("aria-pressed", "true"); toast("Listening… click the mic again to stop"); }
  catch { stop(); }
}
function authNoteHTML() {
  return `<div class="auth-note"><strong>Sending needs a one-time sign-in.</strong> The <code style="background:none;border:none;padding:0">claude</code> CLI isn't signed in (separate from the desktop app).
    <div class="auth-actions"><button type="button" class="btn primary" data-start-login>${svg("user", "ic-sm")} Sign in with your browser</button><button type="button" class="btn ghost" data-recheck-auth>${svg("refresh", "ic-sm")} Check again</button><button type="button" class="applink" data-open-account>or add an API key</button></div></div>`;
}
// Re-run the login check without restarting the server, so after the user runs
// `claude auth login` in a terminal they can clear this banner from the app.
async function recheckAuth(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Checking…`; }
  try {
    const m = await api("/api/meta?recheck=1");
    meta = m;
    const inAcct = acctModalOpen();
    if (m.loggedIn) {
      toast("Signed in — you can send now", "ok");
      if (inAcct) openAccountModal();                                 // refresh the account panel in place
      else if (convo.id && convo.data) renderComposer(convo.data);    // drops the banner, refocuses the box
    } else {
      toast("Still not signed in — run the command in a terminal, then check again", "err");
      if (inAcct) openAccountModal();
      else if (btn) { btn.disabled = false; btn.innerHTML = `${svg("refresh", "ic-sm")} I’ve logged in — check again`; }
    }
  } catch {
    toast("Couldn't check the login state", "err");
    if (btn) { btn.disabled = false; btn.innerHTML = `${svg("refresh", "ic-sm")} I’ve logged in — check again`; }
  }
}
function closeDrawer() {
  $("#drawer").hidden = true; $("#drawerBackdrop").hidden = true; document.body.classList.remove("locked");
  convo.id = null; convo.data = null; markOpenCard(null);
  if (lastFocus?.focus) lastFocus.focus();
}
function markOpenCard(id) {
  $$(".card.open").forEach((el) => el.classList.remove("open"));
  if (id) { try { $(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add("open"); } catch {} }
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------
function sendNow(c) {
  let text = $("#composerText").value.trim();
  const att = pendingAttach.filter((a) => a.path).map((a) => a.path);
  if (pendingAttach.some((a) => a.uploading)) { toast("Still uploading an attachment…"); return; }
  if (!text && !att.length) return;
  if (!text) text = "Please look at the attached file(s).";
  const model = $("#modelSelect")?.value || "";
  const effort = EFFORT_VALUES[Number($("#effortRange")?.value || 0)] || "";
  const mode = $("#modeSelect")?.value || "";
  doSend(c, applyUltracode(text), model, effort, att, mode);
}
function setWorking(on) {
  const box = $("#messages"); if (!box) return;
  let w = $("#workingRow");
  if (on) {
    if (!w) {
      box.insertAdjacentHTML("beforeend", `<div class="msg assistant" id="workingRow"><div class="role">Claude</div><div class="bubble working"><span class="spinner"></span> working…</div></div>`);
      box.scrollTop = box.scrollHeight;
    }
  } else if (w) w.remove();
}
async function doSend(c, text, model, effort, attachments, mode) {
  const sessionId = c.sessionId;
  closeModal();
  const btn = $("#sendBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Working…`; }
  // Optimistic: clear the box, show a working indicator, and poll the transcript
  // so the user's message and Claude's reply stream into this chat as they're written.
  const ta = $("#composerText"); if (ta) ta.value = "";
  pendingAttach = []; renderAttachRow();
  sending = true;
  setWorking(true);
  const poll = setInterval(() => { fetchConvo(sessionId).then((cc) => { setWorking(false); appendNew(cc); setWorking(true); }).catch(() => {}); }, 2500);
  const finish = () => { clearInterval(poll); sending = false; setWorking(false); };
  try {
    const r = await fetch("/api/sessions/" + encodeURIComponent(sessionId) + "/send", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, model, effort, mode: mode || "", attachments: attachments || [] }),
    });
    const data = await r.json().catch(() => ({ ok: false, message: "Unexpected response from server." }));
    finish();
    if (data.ok) {
      try { appendNew(await fetchConvo(sessionId)); } catch {}
      resetSend(btn);
      toast("Reply received", "ok");
    } else if (data.reason === "auth") {
      meta.loggedIn = false; if (data.loginCmd) meta.loginCmd = data.loginCmd;
      if (ta) ta.value = text; resetSend(btn); showAuthHelp(data);
    } else { if (ta) ta.value = text; toast(data.message || "Send failed", "err"); resetSend(btn); }
  } catch (e) { finish(); if (ta) ta.value = text; toast(e.message || "Send failed", "err"); resetSend(btn); }
}
function resetSend(btn) { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.sendlabel || "Send reply"; } }
// Type the message straight into the live Claude app window (bot: clipboard → focus session → ⌘V → Enter).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Poll the transcript until our just-typed message shows up (so we know the
// keystrokes actually landed in the live window), streaming new rows in meanwhile.
async function waitForTypedMessage(sessionId, text, before, timeoutMs) {
  const needle = text.trim();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1500);
    let c;
    try { c = await fetchConvo(sessionId); } catch { continue; }
    if (c.sessionId === convo.id) appendNew(c);
    const hit = (c.messages || []).some((m) => !before.has(m.uuid) && m.role === "user" &&
      (m.blocks || []).some((b) => b.type === "text" && b.text && b.text.includes(needle)));
    if (hit) return true;
  }
  return false;
}
let liveStopping = false;
// Interrupt the running turn in the live window (presses Escape via the app).
async function stopLive(c) {
  if (liveStopping) return;
  liveStopping = true;
  const btn = $("#stopBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Stopping…`; }
  try {
    const r = await fetch("/api/sessions/" + encodeURIComponent(c.sessionId) + "/livestop", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: "{}",
    });
    const data = await r.json().catch(() => ({ ok: false, message: "Unexpected response from server." }));
    if (data.ok) toast("Interrupt sent to the live window", "ok");
    else if (data.reason === "accessibility") showAccessibilityHelp(data);
    else toast(data.message || "Couldn't interrupt the live window", "err");
  } catch (e) {
    toast(e.message || "Couldn't reach the live window", "err");
  } finally {
    liveStopping = false;
    if (btn) { btn.disabled = false; btn.innerHTML = `${svg("stop", "ic-sm")} Stop`; }
  }
}
let liveSending = false;
const liveModel = new Map(); // sessionId -> last model we switched the live window to
async function sendToLiveWindow(c) {
  if (liveSending) return; // guard against rapid Enter firing overlapping pastes
  const ta = $("#composerText");
  const text = (ta?.value || "").trim();
  if (pendingAttach.length) { toast("Files can't be typed into the live window — use ‘send a separate turn here’", "err"); return; }
  if (!text) return;
  liveSending = true;
  // Only switch when the picked model differs from what the window is already on.
  const picked = $("#modelSelect")?.value || "";
  const switchTo = picked && picked !== (liveModel.get(c.sessionId) || c.model) ? picked : undefined;
  const btn = $("#sendBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Typing…`; }
  try {
    const before = new Set(convo.uuids); // messages already known, to spot the new one
    const r = await fetch("/api/sessions/" + encodeURIComponent(c.sessionId) + "/livetype", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, model: switchTo }),
    });
    const data = await r.json().catch(() => ({ ok: false, message: "Unexpected response from server." }));
    if (data.ok) {
      if (switchTo) liveModel.set(c.sessionId, switchTo);
      // Don't clear optimistically — confirm the keystrokes actually reached the live
      // window by waiting for our message to appear in the transcript.
      if (btn) btn.innerHTML = `<span class="spinner"></span> Confirming…`;
      const landed = await waitForTypedMessage(c.sessionId, text, before, 12000);
      if (landed) {
        if (ta && ta.value.trim() === text) ta.value = "";
        toast("Sent to the live window — reply streaming in", "ok");
      } else {
        toast("Couldn't confirm it landed — the live window may not have been focused. Your text is kept.", "err");
      }
    } else if (data.reason === "accessibility") {
      showAccessibilityHelp(data);
    } else {
      toast(data.message || "Couldn't type into the live window", "err");
    }
  } catch (e) {
    toast(e.message || "Couldn't reach the live window", "err");
  } finally { liveSending = false; resetSend(btn); }
}
function showAccessibilityHelp(data) {
  showModal({
    title: "Allow CodeShelf to type into the Claude window",
    bodyHTML: `<p>${esc(data.message || "macOS blocked the keystrokes.")}</p>
      <p style="color:var(--text-3)">Open <b>System Settings → Privacy &amp; Security → Accessibility</b>, then turn on the app that runs this server (your Terminal, or whichever app launched <code style="font-family:var(--mono)">node server.js</code>). Then come back and send again.</p>
      <p style="color:var(--text-3)">Prefer not to grant it? Use <b>“send a separate turn here”</b> — that runs the reply headlessly and still shows up in this chat.</p>`,
    confirmLabel: "Got it", onConfirm: closeModal,
  });
}
function showAuthHelp(data) {
  const cmd = data.loginCmd || meta.loginCmd || "claude auth login";
  showModal({
    title: "Log in to send replies",
    bodyHTML: `<p>${esc(data.message || "The claude command isn't logged in.")}</p>
      <div class="cmdrow" style="display:flex;gap:8px;margin-top:4px"><code style="flex:1;font-family:var(--mono);font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:8px 10px;word-break:break-all">${esc(cmd)}</code><button class="copybtn" data-copy="${esc(cmd)}" aria-label="Copy command">${svg("copy", "ic-sm")}</button></div>
      <p style="color:var(--text-3)">After logging in, come back and send again. (Or set <code style="font-family:var(--mono)">ANTHROPIC_API_KEY</code> before starting the server.)</p>`,
    confirmLabel: "Got it", onConfirm: closeModal,
  });
}

// ---------------------------------------------------------------------------
// Account panel: who the CLI is signed in as, log out, and set/replace an API key.
// ---------------------------------------------------------------------------
async function openAccountModal() {
  let info;
  try { info = await api("/api/account"); }
  catch { info = { loggedIn: false, method: "none", account: "", keySet: false, envKey: false }; }
  renderAccountModal(info);
}
let logoutArmed = false;
function renderAccountModal(info) {
  const method = info.method || "none";
  const icon = method === "apikey" ? "key" : method === "oauth" ? "user" : "alert";
  let line, sub, statusCls;
  if (method === "apikey") {
    line = "Using an API key";
    sub = `Key ${esc(info.account || "")}${info.envKey ? " · from the environment" : ""}`;
    statusCls = "ok";
  } else if (method === "oauth") {
    line = info.account ? `Signed in as ${esc(info.account)}` : "Signed in";
    sub = "Logged in through the claude CLI";
    statusCls = "ok";
  } else {
    line = "Not signed in";
    sub = "Replies can't run until you log in or add an API key";
    statusCls = "warn";
  }
  const loginCmd = meta.loginCmd || "claude auth login";
  const loginBlock = method === "none"
    ? `<div class="acct-actions"><button type="button" class="btn primary" id="acctLogin">${svg("user", "ic-sm")} Sign in with your browser</button><button type="button" class="btn ghost" data-recheck-auth>${svg("refresh", "ic-sm")} Check again</button></div>
       <p class="acct-note">Opens the <code>claude</code> sign-in in your browser — finish there and this updates on its own. Prefer the terminal? Run <code>${esc(loginCmd)}</code>.</p>`
    : "";
  const logoutBlock = method === "oauth"
    ? `<div class="acct-actions"><button type="button" class="btn ghost" id="acctLogout">${svg("logout", "ic-sm")} Log out</button></div>`
    : "";
  // Only a UI/config-saved key is removable from here; an env-provided key isn't ours to delete.
  const keyCurrent = info.keySet
    ? `<div class="acct-keycur"><span>${svg("key", "ic-sm")} Saved key ${esc(info.account || "")}</span><button type="button" class="btn ghost" id="acctClearKey">Remove</button></div>`
    : "";
  const bodyHTML = `
    <div class="acct">
      <div class="acct-status acct-${statusCls}">
        <span class="acct-ico">${svg(icon)}</span>
        <div class="acct-id"><div class="acct-line">${line}</div><div class="acct-sub">${sub}</div></div>
      </div>
      ${loginBlock}${logoutBlock}
      <div class="acct-sep"></div>
      <div class="acct-keyblock">
        <div class="acct-h">API key</div>
        ${keyCurrent}
        <label class="field"><span>${info.keySet ? "Replace the key" : "Add a key (an alternative to logging in)"}</span>
          <div class="keyrow"><input type="password" id="acctKeyInput" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"><button type="button" class="btn primary" id="acctSaveKey">Save</button></div>
        </label>
        <p class="acct-note">Saved locally in <code>~/.codeshelf/config.json</code> (owner-only, 0600) and used only for the local <code>claude</code> process. Replies still count against your normal plan usage.</p>
      </div>
    </div>`;
  showModal({ title: "Account", bodyHTML, confirmLabel: "Done", onConfirm: closeModal, hideCancel: true });
  logoutArmed = false;
  $("#acctSaveKey")?.addEventListener("click", saveApiKeyFromModal);
  $("#acctKeyInput")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveApiKeyFromModal(); } });
  $("#acctClearKey")?.addEventListener("click", clearApiKeyFromModal);
  $("#acctLogout")?.addEventListener("click", logoutFromModal);
  $("#acctLogin")?.addEventListener("click", loginFromModal);
}
// Kick off the CLI's browser sign-in, then poll until it lands (no terminal needed).
async function loginFromModal() {
  const btn = $("#acctLogin"); if (!btn) return;
  const reset = () => { btn.disabled = false; btn.innerHTML = `${svg("user", "ic-sm")} Sign in with your browser`; };
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Opening browser…`;
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: "{}" });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { btn.innerHTML = `<span class="spinner"></span> Waiting for sign-in…`; pollLogin(btn, 0); }
    else { reset(); toast(data.message || "Couldn't start sign-in", "err"); }
  } catch (e) { reset(); toast(e.message || "Couldn't start sign-in", "err"); }
}
// Poll /api/account for ~2 min while the browser flow completes; stop if the modal closes.
async function pollLogin(btn, n) {
  if (n > 60 || !acctModalOpen() || $("#acctLogin") !== btn) { if ($("#acctLogin") === btn) { btn.disabled = false; btn.innerHTML = `${svg("user", "ic-sm")} Sign in with your browser`; } return; }
  await new Promise((r) => setTimeout(r, 2000));
  let info; try { info = await api("/api/account"); } catch { return pollLogin(btn, n + 1); }
  if (info.loggedIn) { await loadMeta(); toast("Signed in", "ok"); if (acctModalOpen()) renderAccountModal(info); return; }
  pollLogin(btn, n + 1);
}
const acctModalOpen = () => !$("#modalBackdrop").hidden && !!$(".acct");
async function saveApiKeyFromModal() {
  const key = ($("#acctKeyInput")?.value || "").trim();
  if (!key) { toast("Paste a key first"); return; }
  const btn = $("#acctSaveKey"); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    const r = await fetch("/api/apikey", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) {
      toast(data.looksAnthropic === false ? "Key saved — note it isn't an sk-ant- key" : "API key saved", "ok");
      await loadMeta(); openAccountModal();
    } else { if (btn) { btn.disabled = false; btn.textContent = "Save"; } toast(data.message || "Couldn't save the key", "err"); }
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "Save"; } toast(e.message || "Couldn't save the key", "err"); }
}
async function clearApiKeyFromModal() {
  try {
    const r = await fetch("/api/apikey/clear", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: "{}" });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { toast("API key removed", "ok"); await loadMeta(); openAccountModal(); }
    else toast("Couldn't remove the key", "err");
  } catch (e) { toast(e.message || "Couldn't remove the key", "err"); }
}
// Two-step confirm (no native dialog): first click arms, second logs out.
function logoutFromModal() {
  const btn = $("#acctLogout"); if (!btn) return;
  if (!logoutArmed) {
    logoutArmed = true; btn.classList.add("warn"); btn.innerHTML = `${svg("logout", "ic-sm")} Click again to log out`;
    setTimeout(() => { if (logoutArmed && $("#acctLogout") === btn) { logoutArmed = false; btn.classList.remove("warn"); btn.innerHTML = `${svg("logout", "ic-sm")} Log out`; } }, 4000);
    return;
  }
  logoutArmed = false;
  doLogout(btn);
}
async function doLogout(btn) {
  btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Logging out…`;
  try {
    const r = await fetch("/api/logout", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: "{}" });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) { toast("Logged out", "ok"); await loadMeta(); openAccountModal(); }
    else { btn.disabled = false; btn.classList.remove("warn"); btn.innerHTML = `${svg("logout", "ic-sm")} Log out`; toast(data.message || "Couldn't log out", "err"); }
  } catch (e) { btn.disabled = false; btn.innerHTML = `${svg("logout", "ic-sm")} Log out`; toast(e.message || "Couldn't log out", "err"); }
}

// ---------------------------------------------------------------------------
// Usage budgets (advisory: track + warn, no enforcement of the real plan limit)
// ---------------------------------------------------------------------------
function openBudgetsModal() {
  const shares = projectShares();
  // Every project currently seen, plus any that already has a budget set.
  const names = new Set(state.sessions.map((s) => s.project));
  Object.keys(state.budgets.projects || {}).forEach((p) => names.add(p));
  const projects = [...names].sort((a, b) => (shares[b] || 0) - (shares[a] || 0));
  const bud = state.budgets;
  const body = `
    <div class="bud">
      <p class="bud-intro">Advisory only — CodeShelf warns you but can't change your real plan limit, and only counts usage it tracks. Leave a field blank for no budget.</p>
      <div class="bud-row"><label for="budFiveHour">5-hour cap <span class="bud-sub">% of plan limit</span></label><div class="bud-inwrap"><input type="number" id="budFiveHour" min="0" max="100" value="${bud.fiveHourPct || ""}" placeholder="off"><span class="bud-pctmark">%</span></div></div>
      <div class="bud-row"><label for="budWeekly">Weekly cap <span class="bud-sub">% of plan limit</span></label><div class="bud-inwrap"><input type="number" id="budWeekly" min="0" max="100" value="${bud.weeklyPct || ""}" placeholder="off"><span class="bud-pctmark">%</span></div></div>
      <div class="bud-sep"></div>
      <div class="bud-h">Per-project weekly budget <span class="bud-sub">share of CodeShelf-tracked weekly tokens</span></div>
      ${projects.length ? `<div class="bud-projects">${projects.map((p) => {
        const cur = Math.round(shares[p] || 0);
        const cap = bud.projects?.[p] || "";
        return `<div class="bud-prow"><span class="bud-pname" title="${esc(p)}">${esc(p)}</span><span class="bud-pcur">${cur}% now</span><div class="bud-inwrap"><input type="number" class="bud-pin" data-project="${esc(p)}" min="0" max="100" value="${cap}" placeholder="off" aria-label="Weekly budget for ${esc(p)} (now ${cur}% of tracked usage), percent"><span class="bud-pctmark">%</span></div></div>`;
      }).join("")}</div>` : `<p class="bud-empty">No projects tracked yet.</p>`}
    </div>`;
  showModal({ title: "Usage budgets", bodyHTML: body, confirmLabel: "Save budgets", onConfirm: saveBudgetsFromModal });
}
async function saveBudgetsFromModal() {
  const payload = {
    fiveHourPct: Number($("#budFiveHour")?.value) || 0,
    weeklyPct: Number($("#budWeekly")?.value) || 0,
    projects: {},
  };
  $$(".bud-pin").forEach((inp) => { const v = Number(inp.value) || 0; if (v > 0) payload.projects[inp.dataset.project] = v; });
  try {
    const r = await fetch("/api/budgets", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({ ok: false }));
    if (data.ok) {
      state.budgets = data.budgets;
      if (state.lastUsage) renderUsage(state.lastUsage);
      renderChips();
      closeModal();
      toast("Budgets saved", "ok");
    } else toast(data.message || "Couldn't save budgets", "err");
  } catch (e) { toast(e.message || "Couldn't save budgets", "err"); }
}

// ---------------------------------------------------------------------------
// New session / move context
// ---------------------------------------------------------------------------
function openNewModal(seedFrom, seedTitle) {
  const folders = meta.folders || [];
  const model = lsGet("ce-model", "");
  const eff = Math.max(0, Math.min(5, lsGet("ce-effort", 0)));
  const sel = { path: null };
  const seedNote = seedFrom ? `<p>Context from <b>${esc(seedTitle || "this session")}</b> (its goal and latest state) will be added as the first message of the new one.</p>` : "";
  showModal({
    title: seedFrom ? "Move context to a new session" : "Start a new session",
    bodyHTML: `${seedNote}
      ${folders.length ? `<label class="field"><span>Jump to a recent project</span>
        <select id="nsQuick" class="model-select"><option value="">— browse below —</option>${folders.map((f) => `<option value="${esc(f.cwd)}">${esc(f.project)}</option>`).join("")}</select></label>` : ""}
      <div class="field"><span>Folder <span class="nspathsel" id="nsSelLabel"></span></span>
        <div class="nsbrowse">
          <div class="nsbrowse-head"><button type="button" class="btn nsup" id="nsUp">↑ Up</button><code class="nspath" id="nsPath">…</code></div>
          <div class="nslist" id="nsList"></div>
          <div class="nsnew"><input id="nsNewName" placeholder="New folder name…" aria-label="New folder name"><button type="button" class="btn" id="nsCreate">Create</button></div>
        </div>
      </div>
      <label class="field"><span>First message${seedFrom ? " (added after the context)" : ""}</span>
        <textarea id="nsMsg" rows="3" placeholder="What should Claude start on?"></textarea></label>
      <div class="composer-controls" style="margin-top:2px">
        <select id="nsModel" class="model-select">${modelOptionsHTML(model)}</select>
        <label class="effort">Effort <input type="range" id="nsEffort" min="0" max="5" value="${eff}" aria-label="Reasoning effort"><span class="elabel" id="nsEffortLabel">${EFFORT_LABELS[eff]}</span></label>
      </div>`,
    confirmLabel: seedFrom ? "Create & hand off" : "Start session",
    onConfirm: () => {
      if (!sel.path) { toast("Pick a folder", "err"); return; }
      doNewSession({ cwd: sel.path, message: $("#nsMsg").value.trim(), model: $("#nsModel").value, effort: EFFORT_VALUES[Number($("#nsEffort").value || 0)] || "", seedFrom });
    },
  });
  async function browse(path) {
    try {
      const d = await api("/api/folders" + (path ? "?path=" + encodeURIComponent(path) : ""));
      sel.path = d.path;
      $("#nsPath").textContent = d.path.replace(d.home, "~");
      $("#nsSelLabel").textContent = "→ opens here";
      $("#nsUp").disabled = !d.parent;
      $("#nsUp").dataset.path = d.parent || "";
      $("#nsList").innerHTML = d.entries.length
        ? d.entries.map((e) => `<button type="button" class="nsentry" data-path="${esc(e.path)}">${svg("folder", "ic-sm")} ${esc(e.name)}</button>`).join("")
        : `<div class="nsempty">No subfolders here</div>`;
    } catch (e) { $("#nsList").innerHTML = `<div class="nsempty">${esc(e.message)}</div>`; }
  }
  $("#nsList").addEventListener("click", (e) => { const b = e.target.closest(".nsentry"); if (b) browse(b.dataset.path); });
  $("#nsUp").addEventListener("click", () => { if ($("#nsUp").dataset.path) browse($("#nsUp").dataset.path); });
  $("#nsQuick")?.addEventListener("change", (e) => { if (e.target.value) browse(e.target.value); });
  $("#nsCreate").addEventListener("click", async () => {
    const name = $("#nsNewName").value.trim();
    if (!name || !sel.path) return;
    try {
      const r = await fetch("/api/mkdir", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ parent: sel.path, name }) });
      const d = await r.json();
      if (d.ok) { $("#nsNewName").value = ""; browse(d.path); toast("Folder created", "ok"); }
      else toast(d.message || "Couldn't create folder", "err");
    } catch { toast("Couldn't create folder", "err"); }
  });
  $("#nsNewName").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#nsCreate").click(); } });
  $("#nsEffort")?.addEventListener("input", (e) => ($("#nsEffortLabel").textContent = EFFORT_LABELS[Number(e.target.value)]));
  browse(seedFrom && folders[0] ? null : null); // start at home
  setTimeout(() => $("#nsMsg")?.focus(), 30);
}
async function doNewSession(p) {
  if (!p.message && !p.seedFrom) { toast("Add a first message", "err"); return; }
  closeModal();
  toast("Starting session…");
  try {
    const r = await fetch("/api/new", { method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const data = await r.json().catch(() => ({ ok: false, message: "Unexpected response." }));
    if (data.ok) { toast("Session started — it'll appear here shortly", "ok"); setTimeout(() => { sigContent = ""; loadSessions(); }, 1800); }
    else if (data.reason === "auth") { meta.loggedIn = false; if (data.loginCmd) meta.loginCmd = data.loginCmd; showAuthHelp(data); }
    else toast(data.message || "Couldn't start the session", "err");
  } catch (e) { toast(e.message || "Couldn't start the session", "err"); }
}

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------
function togglePin(id) {
  if (state.pins.has(id)) state.pins.delete(id); else state.pins.add(id);
  lsSet("ce-pins", [...state.pins]); sigContent = ""; renderContent();
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const THEMES = ["system", "light", "dark"];
const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" };
let themeMode = lsGet("ce-theme", "system");
const mq = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const dark = themeMode === "dark" || (themeMode === "system" && mq.matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const btn = $("#themeBtn");
  btn.innerHTML = svg(THEME_ICON[themeMode]);
  btn.title = "Theme: " + themeMode;
  btn.setAttribute("aria-label", "Theme: " + themeMode + " (click to change)");
}
function cycleTheme() { themeMode = THEMES[(THEMES.indexOf(themeMode) + 1) % THEMES.length]; lsSet("ce-theme", themeMode); applyTheme(); }
mq.addEventListener("change", () => { if (themeMode === "system") applyTheme(); });

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
let notifyOn = lsGet("ce-notify", false);
let fired = new Set(lsGet("ce-fired", []));
function syncNotifyBtn() {
  const btn = $("#notifyBtn");
  const on = notifyOn && window.Notification?.permission === "granted";
  btn.setAttribute("aria-pressed", String(on));
  btn.title = on ? "Notifications on — alerts when a session needs you"
    : window.Notification?.permission === "denied" ? "Notifications blocked in browser settings"
    : "Get notified when a session needs you";
}
async function toggleNotify() {
  if (!("Notification" in window)) { toast("This browser has no notifications", "err"); return; }
  if (notifyOn) { notifyOn = false; lsSet("ce-notify", false); syncNotifyBtn(); toast("Notifications off"); return; }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") { syncNotifyBtn(); toast("Allow notifications in your browser to enable", "err"); return; }
  notifyOn = true; lsSet("ce-notify", true); syncNotifyBtn(); toast("Notifications on", "ok");
}
function maybeNotify() {
  const current = state.sessions.filter((s) => s.needsAttention);
  const tokens = new Set(current.map((s) => s.sessionId + ":" + (s.lastTs || "")));
  if (state.firstPoll) { fired = new Set(tokens); lsSet("ce-fired", [...fired]); return; }
  if (notifyOn && window.Notification?.permission === "granted" && document.hidden) {
    for (const s of current) {
      const tok = s.sessionId + ":" + (s.lastTs || "");
      if (fired.has(tok)) continue; fired.add(tok);
      try { const n = new Notification("Needs you · " + s.project, { body: s.title, tag: s.sessionId }); n.onclick = () => { window.focus(); openSession(s.sessionId); n.close(); }; } catch {}
    }
  } else { for (const tok of tokens) fired.add(tok); }
  for (const tok of [...fired]) if (!tokens.has(tok)) fired.delete(tok);
  lsSet("ce-fired", [...fired]);
}

// ---------------------------------------------------------------------------
// Modal + toast + focus trap
// ---------------------------------------------------------------------------
let modalFocus = null;
// hideCancel: for read-only panels where the confirm just dismisses, so the footer
// shows one button instead of two that do the same thing.
function showModal({ title, bodyHTML, confirmLabel, onConfirm, hideCancel }) {
  modalFocus = document.activeElement;
  const cancelBtn = hideCancel ? "" : `<button class="btn" id="modalCancel">Cancel</button>`;
  $("#modal").innerHTML = `<h3 id="modalTitle">${esc(title)}</h3><div>${bodyHTML}</div><div class="modal-actions">${cancelBtn}<button class="btn primary" id="modalConfirm">${esc(confirmLabel)}</button></div>`;
  $("#modalBackdrop").hidden = false;
  $("#modalCancel")?.addEventListener("click", closeModal);
  $("#modalConfirm").addEventListener("click", onConfirm);
  $("#modalConfirm").focus();
}
function closeModal() { $("#modalBackdrop").hidden = true; if (modalFocus?.focus) modalFocus.focus(); }
let toastTimer = null;
function toast(msg, kind = "") {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), kind === "err" ? 6000 : 3000);
}
// A toast with a single action button (e.g. Undo). The label is escaped; the
// callback fires on click and dismisses the toast.
function toastAction(msg, label, fn, kind = "") {
  const t = $("#toast");
  t.innerHTML = `<span class="toast-msg">${esc(msg)}</span><button type="button" class="toast-act">${esc(label)}</button>`;
  t.className = "toast has-act" + (kind ? " " + kind : ""); t.hidden = false;
  t.querySelector(".toast-act").onclick = () => { t.hidden = true; clearTimeout(toastTimer); fn(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 7000);
}
function trapTab(e) {
  if (e.key !== "Tab") return;
  const root = !$("#modalBackdrop").hidden ? $("#modal") : !$("#drawer").hidden ? $("#drawer") : null;
  if (!root) return;
  const f = $$('a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])', root).filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---------------------------------------------------------------------------
// Minimal, self-contained Markdown → HTML (no deps; matches the strict CSP).
// Everything is HTML-escaped first, so transcript/tool content can't inject markup.
// ---------------------------------------------------------------------------
function mdInline(s) {
  // s is already HTML-escaped. Protect inline-code spans from the other rules.
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+?)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+?)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => {
    const safe = /^(https?:|mailto:)/i.test(u) ? u : "#";
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => `<code>${codes[+i]}</code>`);
}
function mdSplitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
function md(src, depth = 0) {
  // Guard against pathological nesting (e.g. a line of thousands of ">") blowing the stack.
  if (depth > 8) return `<p class="md-p">${esc(String(src ?? "")).replace(/\n/g, "<br>")}</p>`;
  const lines = String(src ?? "").replace(/\r\n/g, "\n").split("\n");
  let out = "", i = 0;
  const esce = (t) => esc(t); // block text still needs escaping before inline rules
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      i++; const buf = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      out += `<pre class="md-pre"><code>${esce(buf.join("\n"))}</code></pre>`;
      continue;
    }
    // Table: a row with pipes followed by a |---|---| separator line.
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*$/.test(lines[i + 1]) && /\|/.test(lines[i + 1])) {
      const header = mdSplitRow(line); i += 2; const rows = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") { rows.push(mdSplitRow(lines[i])); i++; }
      const th = header.map((c) => `<th>${mdInline(esce(c))}</th>`).join("");
      const body = rows.map((r) => `<tr>${header.map((_c, j) => `<td>${mdInline(esce(r[j] || ""))}</td>`).join("")}</tr>`).join("");
      out += `<div class="md-tablewrap"><table class="md-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const l = h[1].length; out += `<h${l} class="md-h md-h${l}">${mdInline(esce(h[2].replace(/\s+#+\s*$/, "")))}</h${l}>`; i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out += `<hr class="md-hr">`; i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      out += `<blockquote class="md-quote">${md(buf.join("\n"), depth + 1)}</blockquote>`;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && (/^\s*\d+[.)]\s+/.test(lines[i]) === ordered)) {
        items.push(`<li>${mdInline(esce(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, "")))}</li>`); i++;
      }
      out += ordered ? `<ol class="md-list">${items.join("")}</ol>` : `<ul class="md-list">${items.join("")}</ul>`;
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*```|^\s*>|^#{1,6}\s|^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) { buf.push(lines[i]); i++; }
    out += `<p class="md-p">${mdInline(esce(buf.join("\n"))).replace(/\n/g, "<br>")}</p>`;
  }
  return out;
}
function highlight(text, q) {
  let e = esc(text);
  for (const term of q.split(/\s+/).filter(Boolean)) {
    try { e = e.replace(new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), '<mark class="hl">$1</mark>'); } catch {}
  }
  return e;
}
function timeAgo(ts) {
  if (!ts) return "";
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return new Date(t).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
document.addEventListener("click", (e) => {
  if (e.target.closest("a[href]")) return; // let real links (Open in Claude, etc.) work
  // Close composer popovers on any click outside their triggers/panels.
  if (!e.target.closest("#turnBtn,#primaryMore,.settings-pop,.send-menu")) closeComposerPopovers();
  const sendnow = e.target.closest("[data-sendnow]");
  if (sendnow) { if (sendnow.disabled) return; closeComposerPopovers(); forceSend(); return; }
  const recheck = e.target.closest("[data-recheck-auth]");
  if (recheck) { e.stopPropagation(); recheckAuth(recheck); return; }
  const startLogin = e.target.closest("[data-start-login]");
  if (startLogin) { e.stopPropagation(); openAccountModal(); return; } // the modal drives the browser sign-in + polling
  const openAcct = e.target.closest("[data-open-account]");
  if (openAcct) { e.stopPropagation(); openAccountModal(); return; }
  const copy = e.target.closest("[data-copy]");
  if (copy) { e.stopPropagation(); navigator.clipboard?.writeText(copy.dataset.copy).then(() => toast("Copied", "ok"), () => toast("Copy failed", "err")); return; }
  const rm = e.target.closest("[data-attach-remove]");
  if (rm) { pendingAttach.splice(Number(rm.dataset.attachRemove), 1); renderAttachRow(); return; }
  const requeue = e.target.closest("[data-requeue]");
  if (requeue) { e.stopPropagation(); requeueItem(requeue.dataset.requeue); return; }
  const edit = e.target.closest("[data-edit]");
  if (edit) { e.stopPropagation(); editQueued(edit.dataset.edit); return; }
  const dq = e.target.closest("[data-dequeue]");
  if (dq) { e.stopPropagation(); removeQueued(dq.dataset.dequeue); return; }
  const qt = e.target.closest(".qtext.clamp");
  if (qt) { toggleQueueExpand(qt); return; }
  const pin = e.target.closest("[data-pin]");
  if (pin) { e.stopPropagation(); togglePin(pin.dataset.pin); return; }
  const view = e.target.closest("[data-view]");
  if (view) { convo.msgView = view.dataset.view; renderMsgFilter(); renderMessages(true); return; }
  const card = e.target.closest(".card");
  if (card) { openSession(card.dataset.id); return; }
  const tile = e.target.closest("[data-status]");
  if (tile) { state.statusFilter = state.statusFilter === tile.dataset.status ? "all" : tile.dataset.status; sigSignal = sigChips = sigContent = ""; renderSignal(); renderChips(); renderContent(); return; }
  const bpt = e.target.closest("#byProjToggle");
  if (bpt) { byProjOpen = !byProjOpen; lsSet("ce-byproj", byProjOpen); sigByProj = ""; renderUsageByProject(); return; }
  const chip = e.target.closest("[data-project]");
  if (chip) { state.projectFilter = chip.dataset.project || null; sigChips = sigContent = ""; renderChips(); renderContent(); return; }
  if (e.target === $("#modalBackdrop")) closeModal();
  if (e.target === $("#drawerBackdrop")) closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("card")) { e.preventDefault(); openSession(e.target.dataset.id); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("qtext") && e.target.classList?.contains("clamp")) { e.preventDefault(); toggleQueueExpand(e.target); return; }
  if (e.key === "Escape") {
    if ($$(".settings-pop, .send-menu").some((p) => !p.hidden)) return closeComposerPopovers();
    if (!$("#modalBackdrop").hidden) return closeModal();
    if (!$("#drawer").hidden) return closeDrawer();
  }
  trapTab(e);
});
$("#searchInput").addEventListener("input", (e) => onSearch(e.target.value));
$("#projectChips").addEventListener("scroll", updateChipFades, { passive: true });
window.addEventListener("resize", updateChipFades);
$("#drawerClose").addEventListener("click", closeDrawer);
$("#handoffBtn")?.addEventListener("click", () => { if (convo.data) openNewModal(convo.data.sessionId, convo.data.title); });
$("#refreshBtn").addEventListener("click", () => { loadSessions(); loadUsage(); loadMeta(); loadBudgets(); });
$("#themeBtn").addEventListener("click", cycleTheme);
$("#notifyBtn").addEventListener("click", toggleNotify);
$("#accountBtn").addEventListener("click", openAccountModal);
$("#budgetBtn").addEventListener("click", openBudgetsModal);
$("#newBtn")?.addEventListener("click", () => openNewModal());

// ---------------------------------------------------------------------------
// Boot + polling
// ---------------------------------------------------------------------------
setStaticIcons();
applyTheme();
syncNotifyBtn();
loadSessions();
loadUsage();
loadMeta();
loadBudgets();
setInterval(() => {
  if (!$("#autorefresh").checked || document.hidden) return;
  loadSessions(); loadUsage(); refreshOpenSession();
}, 5000);
