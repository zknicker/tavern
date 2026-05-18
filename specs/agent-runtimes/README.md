# OpenClaw Runtime Specs

These specs define how Tavern Runtime manages OpenClaw.

Tavern currently supports exactly one runtime product: OpenClaw. This folder still describes an
Tavern-owned runtime boundary so product contracts, naming, and projections do not collapse into
raw OpenClaw terms.

Tavern Runtime installs, starts, supervises, upgrades, and launches OpenClaw with Seatbelt
guardrails. Tavern observes it, syncs local projections, and exposes OpenClaw-owned records through
Tavern product primitives.

The specs in this folder are runtime-facing and current-state only. Research notes, sidecar plans,
and migration narratives belong outside `specs/` or should be deleted once superseded.

## Scope

- Managed OpenClaw lifecycle and primitive ownership.
- Tavern-facing Gateway behavior.
- OpenClaw Gateway adapter surfaces.
- OpenClaw event streams and sync expectations.
- OpenClaw security, chat, session, and agent expectations.

Shared Tavern product behavior remains in the top-level specs. Tavern-owned runtime behavior lives
in `../../docs/internals/runtime.md` and the memory specs. Memory is provided by Tavern Runtime to
OpenClaw agents.

## Specs

- `agent-runtimes.md`: OpenClaw ownership and projection model.
- `tavern-messenger.md`: first-party Tavern chat channel/plugin expectations.
- `openclaw-gateway.md`: implemented OpenClaw Gateway integration contract.
- `capability-degradation.md`: capability-level OpenClaw degradation model.
- `communication-regression.md`: deterministic OpenClaw communication regression scenarios.
- `agents.md`: OpenClaw agent expectations.
- `chats.md`: OpenClaw chat expectations.
- `sessions.md`: OpenClaw session expectations.
- `security.md`: managed runtime, secret, and execution boundary expectations.
