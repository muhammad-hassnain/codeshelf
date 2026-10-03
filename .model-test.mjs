// Throwaway: exercises the model vetting + labeling without starting the server.
// Mirrors public/app.js modelLabel() and server.js modelAllowed() exactly.

const MODEL_LABELS = {
  "claude-opus-4-8": "Opus 4.8", "claude-opus-4-7": "Opus 4.7",
  "claude-sonnet-4-5": "Sonnet 4.5", "claude-haiku-4-5": "Haiku 4.5",
  "claude-fable-5": "Fable 5", "claude-fable-5-1": "Fable 5.1",
};
function modelLabel(raw) {
  if (!raw || raw === "<synthetic>") return "";
  if (MODEL_LABELS[raw]) return MODEL_LABELS[raw];
  const m = raw.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/i);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1) + " " + m[2] + (m[3] ? "." + m[3] : "");
  return raw.replace(/^claude-/, "");
}

const MODEL_ALIASES = new Set(["opus", "sonnet", "haiku", "fable", "opusplan", "default"]);
const MODEL_ID_RE = /^claude-[a-z]+-[0-9][0-9a-z-]{0,30}$/i;
function modelAllowed(m) { return MODEL_ALIASES.has(m) || MODEL_ID_RE.test(m); }

const cases = [
  "opus", "sonnet", "haiku", "fable", "opusplan", "default",
  "claude-opus-4-7", "claude-opus-4-8", "claude-opus-5-5",
  "claude-sonnet-5-5", "claude-sonnet-4-5",
  "claude-haiku-4-5", "claude-haiku-4-5-20251001",
  "claude-fable-5-1",
  "claude-opus-4-6",
  "<synthetic>", "",
  "gpt-4", "something-weird",
  "claude; rm -rf /", "../etc/passwd", "claude-opus-$(whoami)",
  "CLAUDE-OPUS-5-5",
];

console.log("id".padEnd(32), "allowed".padEnd(8), "label");
console.log("--".padEnd(32), "-------".padEnd(8), "-----");
for (const id of cases) {
  console.log(JSON.stringify(id).padEnd(32), String(modelAllowed(id)).padEnd(8), JSON.stringify(modelLabel(id)));
}
