# Hermes Runtime Specs

These specs define how Tavern Runtime manages Hermes.

Tavern currently supports exactly one runtime product: Hermes. This folder describes the
Tavern-owned runtime boundary so product contracts and naming do not collapse into raw Hermes
terms.

Tavern Runtime installs, starts, supervises, upgrades, and launches Hermes with Seatbelt
guardrails. Tavern observes it and maps runtime behavior into Tavern product primitives.

The specs in this folder are runtime-facing and current-state only. Research notes, sidecar plans,
and migration narratives belong outside `specs/` or should be deleted once superseded.

## Scope

- Managed Hermes lifecycle and primitive ownership.
- Tavern-facing Gateway behavior.
- Hermes Gateway adapter surfaces.
- Hermes event streams and sync expectations.
- Hermes security, chat, session, and agent expectations.

Shared Tavern product behavior remains in the top-level specs. Tavern-owned runtime behavior lives
in `../../docs/internals/runtime.md` and the memory specs. Memory is provided by Tavern Runtime to
Hermes agents.

## Specs

- `agent-runtimes.md`: Hermes ownership and runtime mapping model.
- `tavern-messenger.md`: first-party Tavern chat channel/plugin expectations.
- `hermes-gateway.md`: implemented Hermes Gateway adapter contract.
- `capability-degradation.md`: capability-level Hermes degradation model.
- `communication-regression.md`: deterministic Hermes communication regression scenarios.
- `agents.md`: Hermes agent expectations.
- `chats.md`: Hermes chat expectations.
- `sessions.md`: Hermes session expectations.
- `security.md`: managed runtime, secret, and execution boundary expectations.
