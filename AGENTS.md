# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Aider, etc.) working in this repository. Humans: see [README.md](README.md).

## What this is

**CodeShelf** is a local, zero-dependency Node web app that reads the files Claude Code keeps under `~/.claude` and presents a live dashboard to monitor, search, and reply to sessions. One backend file (`server.js`), a static frontend (`public/`). No framework, no build step, no package dependencies.

## Run / verify

```bash
node server.js          # serves http://127.0.0.1:4178  (or: npm start)
```

- **No build, no bundler, no tests to run.** Verify syntax with `node --check server.js` and `node --check public/app.js`.
- **`server.js` changes require a restart** to take effect. **`public/*` is served fresh on browser reload** (no restart needed).
- To verify UI changes, open `http://127.0.0.1:4178` in a browser and reload. There is a `.claude/launch.json` so the Claude app's preview can launch it by name (`codeshelf`).
- Keep it **dependency-free**. Do not add npm packages or external CDN assets — the frontend ships under a strict self-only CSP.

## Architecture

| File | Responsibility |
| --- | --- |
| `server.js` | HTTP server + JSON API, all security gates, session/usage reading, reply + new-session + live-window-typing logic. ESM, Node ≥18, standard-library only. |
| `public/index.html` | App shell + element IDs the frontend wires to. |
| `public/app.js` | All frontend logic: polling, rendering (board, drawer, composer), the Markdown renderer, send paths. ESM module. |
| `public/style.css` | The "reading room" theme and all component styles. Tokens on `:root`, redefined for dark. |
| `public/theme-init.js` | Applies saved/system theme before first paint (no FOUC). |

### Data model (read-only against `~/.claude`)
- **Live status:** `~/.claude/sessions/<pid>.json` has a `status` (`busy`/`idle`); the pid is cross-checked for being alive. alive+busy → **Working**, alive+idle → **Need input**, no live process → **Inactive**.
- **Conversations:** `~/.claude/projects/<project>/<uuid>.jsonl` transcripts (one level deep; deeper files are subagent/workflow journals and are excluded).
- **Plan usage:** `~/Library/Application Support/Claude/plan-usage-history.json` (macOS).

CodeShelf **never writes** to `~/.claude`. The only writes it makes are: a reply you send (via the `claude` CLI, which appends to the transcript) and uploaded attachments under `~/.codeshelf/uploads`.

## Hard constraints (do not break)

- **Security model.** The server is loopback-only and hardened against malicious web pages: per-start token on every `/api` call, Host-header allowlist (anti DNS-rebinding), Origin/Sec-Fetch + JSON content-type checks on writes (anti-CSRF), UUID validation, `--` argument termination on every spawned `claude`, server-derived working directory, strict CSP/headers. **Preserve all of these** when editing endpoints. Never interpolate user/transcript input into a shell; spawn with an argv array; pass data to `pbcopy`/`osascript` via stdin or argv, never string-concatenated into a script.
- **Reads stay read-only.** Don't write to `~/.claude`.
- **Design language.** Flat "reading room" aesthetic: warm paper/ink (light), walnut/leather (dark), pine-green accent, native system fonts (`-apple-system`/`system-ui`, `ui-monospace`). **No gradients, no emoji-as-icons** (inline SVG icons only). Keep WCAG AA contrast and the icon+text+color status encoding.
- **Zero dependencies / strict CSP.** No npm packages, no external scripts or fonts. Anything you'd reach for a library for (e.g. Markdown) is written inline and HTML-escapes input first.

## Platform notes

- **macOS-only features:** live-window typing (`open`, `osascript`, `pbcopy`) and the plan-usage panel (reads a macOS path). The session board itself is just file reads and could be adapted elsewhere.
- **Sending requires the `claude` CLI to be logged in** (`claude auth login`) or `ANTHROPIC_API_KEY` set. The desktop app's keychain login does **not** cover headless CLI runs.
- **Live-window typing needs macOS Accessibility permission** for the process running `node server.js`. Keystrokes only reach the frontmost app, so the automation briefly fronts Claude, pastes, and restores focus; it then confirms the message landed in the transcript before clearing the composer.

## Conventions

- ESM everywhere (`import`/`export`, `"type": "module"`).
- Match the surrounding terse, comment-where-non-obvious style. Favor small pure helpers.
- Frontend: vanilla DOM, `$`/`$$` helpers, template strings for rendering, `esc()` for all interpolated text. The Markdown renderer (`md()`) escapes first, then transforms — keep that ordering.
- Env/config knobs: `PORT`, `HOST`, `CLAUDE_CONFIG_DIR`, `CLAUDE_BIN`, `CE_ORG`, `ANTHROPIC_API_KEY`.

## Common tasks

- **Add an API endpoint:** put it behind the same token + (for writes) same-site + JSON-content-type gates as the existing routes in the request handler in `server.js`.
- **Add a frontend view/control:** render with template strings, wire events after `innerHTML`, use existing tokens/classes in `style.css`.
- **Change behavior of sending:** the headless path is `sendToSession` (`claude --resume … -p`); the live-window path is `typeIntoLiveWindow` (clipboard → `open -g` deep link → `osascript` paste → restore focus). Both are in `server.js`; the client calls them from `sendNow` / `sendToLiveWindow` in `public/app.js`.

## Before opening a PR

1. `node --check server.js && node --check public/app.js`
2. Start the server and click through the affected UI in a browser.
3. Keep the security gates, read-only guarantee, zero-dependency rule, and design language intact.
