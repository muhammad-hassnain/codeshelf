# Security Policy

CodeShelf runs a local web server that exposes your Claude Code session data and can execute replies as the `claude` CLI. Security is taken seriously.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use GitHub's private vulnerability reporting:

> Repository **Security** tab → **Report a vulnerability**

(If private reporting isn't available on the repo, open a minimal public issue asking for a private contact and details will be arranged.)

Please include what you found, steps to reproduce, and the impact. You'll get an acknowledgement as soon as possible.

## Design & threat model

CodeShelf binds to loopback and assumes the main threat is a **malicious web page open in your browser** trying to reach the local server, plus **CLI-argument / shell injection** through the reply paths. Mitigations in place:

- **Loopback bind** (`127.0.0.1`) and a **Host-header allowlist** (anti DNS-rebinding).
- A **per-start access token** required on every `/api` request (a cross-origin page can't read it).
- **Origin / Sec-Fetch + JSON content-type** checks on all write endpoints (anti-CSRF).
- **UUID validation** on session ids, **`--` argument termination** on every spawned `claude` command, and a **server-derived working directory** (callers can't choose where an agent runs).
- Messages are passed to `pbcopy` / `osascript` via **stdin / argv**, never concatenated into a shell or script.
- One-reply / one-paste-per-session locks, and strict response headers (CSP, `nosniff`, `no-store`, `frame-ancestors 'none'`).

## Scope & expectations

- CodeShelf is intended to run **only on `localhost`** for a single user. Exposing it on a non-loopback address (`HOST=0.0.0.0`) removes a core protection and is not supported.
- It reads `~/.claude` **read-only**; the only writes are replies you send and attachments you upload.
- Sending/creating sessions runs the real `claude` CLI and uses your tokens — treat the reply box as you would a terminal.
