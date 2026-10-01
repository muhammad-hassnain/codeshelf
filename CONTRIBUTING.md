# Contributing to CodeShelf

Thanks for your interest! CodeShelf is deliberately small and dependency-free. Contributions that keep it that way are very welcome.

## Getting set up

```bash
git clone https://github.com/muhammad-hassnain/codeshelf.git
cd codeshelf
node server.js   # http://127.0.0.1:4178
```

No install step — it's standard-library Node (18+) with a static frontend.

## Ground rules

- **Zero dependencies.** No npm packages, no external scripts or web fonts. If you need something a library usually provides (Markdown, etc.), write a small, inline, input-escaping version.
- **Reads stay read-only.** Never write to the user's `~/.claude` files.
- **Keep the security gates.** The server is loopback-only and hardened (per-start token, Host-header allowlist, Origin/Sec-Fetch + JSON checks on writes, UUID validation, `--` arg termination, server-derived cwd, strict CSP). Don't weaken these; spawn processes with argv arrays, never shell strings.
- **Keep the design language.** Flat "reading room" theme, system fonts, inline-SVG icons, no gradients or emoji-as-icons, WCAG AA contrast, and status shown as icon + text + color.

## Before you open a PR

1. `node --check server.js && node --check public/app.js`
2. Run the server and click through the parts of the UI you touched (light **and** dark, and a narrow window for mobile).
3. If you changed a send/automation path, test it against a real session and confirm the transcript updates.

Working with an AI coding agent? It can read [AGENTS.md](AGENTS.md) for architecture and constraints.

## Reporting bugs / ideas

Open an issue with steps to reproduce (and your macOS + Node versions). For anything security-sensitive, see [SECURITY.md](SECURITY.md) instead of filing a public issue.
