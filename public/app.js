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
const MODELS = [
  { v: "", label: "Default model" }, { v: "opus", label: "Opus" }, { v: "sonnet", label: "Sonnet" },
  { v: "haiku", label: "Haiku" }, { v: "fable", label: "Fable" },
];
const EFFORT_VALUES = ["", "low", "medium", "high", "xhigh", "max"];
const EFFORT_LABELS = ["Default", "Low", "Medium", "High", "X-High", "Max"];

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const state = {
  sessions: [], counts: {},
  statusFilter: "all", projectFilter: null, search: "",
  pins: new Set(lsGet("ce-pins", [])), firstPoll: true, totals: { fiveHour: 0, week: 0 },
};
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
    renderSignal(); renderChips();
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
  const sig = JSON.stringify([projects, state.projectFilter]);
  if (sig === sigChips) return;
  sigChips = sig;
  const all = !state.projectFilter;
  $("#projectChips").innerHTML =
    `<button class="chip ${all ? "active" : ""}" data-project="" aria-pressed="${all}">All<span class="n">${state.sessions.length}</span></button>` +
    projects.map(([p, n]) => `<button class="chip ${state.projectFilter === p ? "active" : ""}" data-project="${esc(p)}" aria-pressed="${state.projectFilter === p}">${esc(p)}<span class="n">${n}</span></button>`).join("");
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
  const actions = `${s.pendingTool ? `<span class="tool">${svg("terminal", "ic-sm")} ${esc(s.pendingTool)}</span>` : ""}${s.status === "waiting" ? `<span class="needs">needs input</span>` : ""}${s.live && s.appLink ? `<a class="applink" href="${esc(s.appLink)}" title="Open this live session in the Claude app">${svg("external", "ic-sm")} open live</a>` : ""}`;
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
  if (!u || !u.available) { box.innerHTML = `<div class="ucard muted" style="grid-column:1/-1">Plan usage history isn't available to read on this machine.</div>`; return; }
  const upd = u.updatedAt ? "updated " + timeAgo(u.updatedAt) : "";
  box.innerHTML = gauge("Last 5 hours", u.fiveHour, "var(--work)", "var(--work-dot)", upd) + gauge("This week", u.weekly, "var(--accent-2)", "var(--accent)", upd);
}
function gauge(label, d, strong, soft, upd) {
  const pct = Math.round(d.current || 0);
  const col = pct >= 90 ? "var(--urgent)" : strong;
  const dot = pct >= 90 ? "var(--urgent)" : soft;
  return `<div class="ucard" style="--uc:${col}" aria-label="${label}: ${pct}% used">
    <div class="uinfo">
      <div class="ulabel"><span class="led" style="background:${dot}"></span>${label}</div>
      <div class="urow"><span class="upct">${pct}%</span><span class="usub">${upd}</span></div>
      <div class="ubar"><div class="ufill" style="width:${Math.min(100, pct)}%"></div></div>
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
  convo.data = c;
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
  if (!convo.id || !convo.live || document.hidden || sending) return;
  try {
    const c = await fetchConvo(convo.id);
    appendNew(c);
    if (c.live !== convo.live) { convo.live = c.live; }
  } catch {}
}
function updateConvoHeader(c) {
  const st = STATUS[c.status] || STATUS.closed;
  $("#convoMeta").innerHTML = `<span class="proj">${esc(c.project)}</span><span class="status ${st.cls}" style="font-size:10px">${statusIcon(c.status)}${st.label}</span><span class="meta" style="font-family:var(--mono)">${c.totalMessages} messages</span>${c.truncated ? `<span>showing last ${c.returnedMessages}</span>` : ""}`;
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
  const chosen = lsGet("ce-model", "");
  const eff = Math.max(0, Math.min(5, lsGet("ce-effort", 0)));
  const authNote = !meta.loggedIn ? authNoteHTML() : "";
  // Live-window typing uses macOS GUI automation, so offer it only on macOS.
  const liveBot = c.live && !!c.appLink && meta.platform !== "win32" && meta.platform !== "linux";
  const liveNote = liveBot
    ? `<div class="live-note">${svg("activity", "ic-sm")}<span class="ln-main">Typed into the live Claude window — syncs to Remote Control &amp; phone, and the reply streams in here. Claude briefly comes forward, then focus returns to your window.</span><button type="button" class="applink ln-toggle" id="liveDetailsBtn" aria-expanded="false" aria-controls="liveMore">Details</button><div class="ln-more" id="liveMore" hidden>First use asks for macOS Accessibility permission (once). Attachments can't be typed in — <button type="button" class="applink" id="headlessLink" title="Run the reply as a separate headless turn instead">send a separate turn here</button> for those${meta.rcUrl ? ` · <a class="applink" href="${esc(meta.rcUrl)}" target="_blank" rel="noopener">Remote Control ↗</a>` : ""}.</div></div>`
    : c.live
      ? `<div class="live-note">${svg("activity", "ic-sm")}<span class="ln-main">Your reply runs as its own turn and shows up below.</span>${meta.rcUrl ? `<a class="applink" href="${esc(meta.rcUrl)}" target="_blank" rel="noopener">Remote Control ↗</a>` : ""}</div>`
      : "";
  el.innerHTML = `${authNote}${liveNote}
    <div class="attach-row" id="attachRow" hidden></div>
    <textarea id="composerText" placeholder="Reply to this session…  (Enter to send · Shift+Enter for a new line · paste or drop images)"></textarea>
    <div class="composer-controls">
      <button class="cbtn" id="attachBtn" type="button" aria-label="Attach image or file" title="Attach image / file">${svg("paperclip", "ic-sm")}</button>
      <button class="cbtn" id="micBtn" type="button" aria-pressed="false" aria-label="Dictate (voice to text)" title="Dictate — voice to text">${svg("mic", "ic-sm")}</button>
      <select class="model-select" id="modelSelect" aria-label="Model">${MODELS.map((m) => `<option value="${m.v}" ${m.v === chosen ? "selected" : ""}>${m.label}</option>`).join("")}</select>
      <label class="effort">Effort <input type="range" id="effortRange" min="0" max="5" step="1" value="${eff}" aria-label="Reasoning effort" aria-valuetext="${EFFORT_LABELS[eff]}"><span class="elabel" id="effortLabel">${EFFORT_LABELS[eff]}</span></label>
      <span class="grow"></span>
      <button class="btn" id="handoffBtn" type="button" title="Start a new session seeded with this one's context">Move context →</button>
      <button class="btn primary" id="sendBtn" data-sendlabel="${liveBot ? "Send to live window" : "Send reply"}">${liveBot ? "Send to live window" : "Send reply"}</button>
    </div>
    <input type="file" id="attachInput" multiple style="display:none" accept="image/*,.pdf,.txt,.md,.csv,.json,.log" />`;
  $("#handoffBtn").addEventListener("click", () => openNewModal(c.sessionId, c.title));
  $("#liveDetailsBtn")?.addEventListener("click", () => {
    const more = $("#liveMore"), b = $("#liveDetailsBtn"); if (!more) return;
    const show = more.hidden; more.hidden = !show; b.setAttribute("aria-expanded", String(show)); b.textContent = show ? "Hide" : "Details";
  });
  $("#headlessLink")?.addEventListener("click", () => sendNow(c)); // headless fallback (files, or if the bot fails)
  $("#modelSelect").addEventListener("change", (e) => lsSet("ce-model", e.target.value));
  const range = $("#effortRange");
  range.addEventListener("input", (e) => {
    const i = Number(e.target.value); lsSet("ce-effort", i);
    $("#effortLabel").textContent = EFFORT_LABELS[i]; range.setAttribute("aria-valuetext", EFFORT_LABELS[i]);
  });
  $("#attachBtn").addEventListener("click", () => $("#attachInput").click());
  $("#attachInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
  $("#micBtn").addEventListener("click", toggleMic);
  const ta = $("#composerText");
  // Enter sends; Shift+Enter inserts a newline. No confirmation step.
  // For a live session, Enter types straight into the live Claude window; otherwise it runs a headless reply.
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); liveBot ? sendToLiveWindow(c) : sendNow(c); } });
  ta.addEventListener("paste", (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); addFiles(imgs.map((it) => it.getAsFile()).filter(Boolean)); }
  });
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("dragging"); });
  el.addEventListener("dragleave", (e) => { if (e.target === el) el.classList.remove("dragging"); });
  el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("dragging"); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  $("#sendBtn").addEventListener("click", () => liveBot ? sendToLiveWindow(c) : sendNow(c));
  renderAttachRow();
  setTimeout(() => ta.focus(), 20);
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
  return `<div class="auth-note"><strong>Sending needs a one-time login.</strong> The app launches the <code style="background:none;border:none;padding:0">claude</code> command, which isn't signed in (the desktop app's login is separate). In a terminal, run this once:
    <div class="cmdrow"><code>${esc(meta.loginCmd || "claude auth login")}</code><button class="copybtn" data-copy="${esc(meta.loginCmd || "claude auth login")}" aria-label="Copy command">${svg("copy", "ic-sm")}</button></div></div>`;
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
  doSend(c, text, model, effort, att);
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
async function doSend(c, text, model, effort, attachments) {
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
      body: JSON.stringify({ message: text, model, effort, attachments: attachments || [] }),
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
let liveSending = false;
async function sendToLiveWindow(c) {
  if (liveSending) return; // guard against rapid Enter firing overlapping pastes
  const ta = $("#composerText");
  const text = (ta?.value || "").trim();
  if (pendingAttach.length) { toast("Files can't be typed into the live window — use ‘send a separate turn here’", "err"); return; }
  if (!text) return;
  liveSending = true;
  const btn = $("#sendBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Typing…`; }
  try {
    const before = new Set(convo.uuids); // messages already known, to spot the new one
    const r = await fetch("/api/sessions/" + encodeURIComponent(c.sessionId) + "/livetype", {
      method: "POST", headers: { "X-CE-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const data = await r.json().catch(() => ({ ok: false, message: "Unexpected response from server." }));
    if (data.ok) {
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
        <select id="nsModel" class="model-select">${MODELS.map((m) => `<option value="${m.v}" ${m.v === model ? "selected" : ""}>${m.label}</option>`).join("")}</select>
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
function showModal({ title, bodyHTML, confirmLabel, onConfirm }) {
  modalFocus = document.activeElement;
  $("#modal").innerHTML = `<h3 id="modalTitle">${esc(title)}</h3><div>${bodyHTML}</div><div class="modal-actions"><button class="btn" id="modalCancel">Cancel</button><button class="btn primary" id="modalConfirm">${esc(confirmLabel)}</button></div>`;
  $("#modalBackdrop").hidden = false;
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalConfirm").addEventListener("click", onConfirm);
  $("#modalConfirm").focus();
}
function closeModal() { $("#modalBackdrop").hidden = true; if (modalFocus?.focus) modalFocus.focus(); }
let toastTimer = null;
function toast(msg, kind = "") {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), kind === "err" ? 6000 : 3000);
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
  const copy = e.target.closest("[data-copy]");
  if (copy) { e.stopPropagation(); navigator.clipboard?.writeText(copy.dataset.copy).then(() => toast("Copied", "ok"), () => toast("Copy failed", "err")); return; }
  const rm = e.target.closest("[data-attach-remove]");
  if (rm) { pendingAttach.splice(Number(rm.dataset.attachRemove), 1); renderAttachRow(); return; }
  const pin = e.target.closest("[data-pin]");
  if (pin) { e.stopPropagation(); togglePin(pin.dataset.pin); return; }
  const view = e.target.closest("[data-view]");
  if (view) { convo.msgView = view.dataset.view; renderMsgFilter(); renderMessages(true); return; }
  const card = e.target.closest(".card");
  if (card) { openSession(card.dataset.id); return; }
  const tile = e.target.closest("[data-status]");
  if (tile) { state.statusFilter = state.statusFilter === tile.dataset.status ? "all" : tile.dataset.status; sigSignal = sigChips = sigContent = ""; renderSignal(); renderChips(); renderContent(); return; }
  const chip = e.target.closest("[data-project]");
  if (chip) { state.projectFilter = chip.dataset.project || null; sigChips = sigContent = ""; renderChips(); renderContent(); return; }
  if (e.target === $("#modalBackdrop")) closeModal();
  if (e.target === $("#drawerBackdrop")) closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("card")) { e.preventDefault(); openSession(e.target.dataset.id); return; }
  if (e.key === "Escape") { if (!$("#modalBackdrop").hidden) return closeModal(); if (!$("#drawer").hidden) return closeDrawer(); }
  trapTab(e);
});
$("#searchInput").addEventListener("input", (e) => onSearch(e.target.value));
$("#projectChips").addEventListener("scroll", updateChipFades, { passive: true });
window.addEventListener("resize", updateChipFades);
$("#drawerClose").addEventListener("click", closeDrawer);
$("#refreshBtn").addEventListener("click", () => { loadSessions(); loadUsage(); loadMeta(); });
$("#themeBtn").addEventListener("click", cycleTheme);
$("#notifyBtn").addEventListener("click", toggleNotify);
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
setInterval(() => {
  if (!$("#autorefresh").checked || document.hidden) return;
  loadSessions(); loadUsage(); refreshOpenSession();
}, 5000);
