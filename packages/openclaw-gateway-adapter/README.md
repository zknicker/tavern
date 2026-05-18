# OpenClaw Gateway Adapter

`@tavern/openclaw-gateway-adapter` makes an OpenClaw Gateway look like Tavern's
runtime evidence and managed OpenClaw control surfaces.

```txt
Tavern Server
  -> @tavern/openclaw-gateway-adapter
  -> OpenClaw Gateway WebSocket RPC
```

OpenClaw already exposes a Gateway WebSocket protocol for operator clients, so this package is a
library adapter. It is not an OpenClaw fork, HTTP sidecar, or filesystem reader. Tavern chat enters
OpenClaw through Tavern Runtime's private Tavern Messenger relay, not through public Tavern-specific
Gateway RPCs.

## Public API

- `createOpenClawGatewayClient(options)`
  Low-level Gateway WebSocket RPC client.
- `createOpenClawAgentRuntimeClient(options)`
  Tavern protocol-compatible client backed by OpenClaw Gateway RPC.
- `subscribeOpenClawAgentRuntimeEvents(options, handler)`
  OpenClaw Gateway event subscription mapped to Tavern agent-runtime events.

## Auth

OpenClaw Gateway connections use the Gateway token/password plus a signed device identity. This
package accepts `auth` and `device` options but does not persist secrets or private keys. Tavern
Server owns that storage under its own data directory and passes the signer into this package.

## Mapping

| Tavern surface | OpenClaw Gateway surface |
| --- | --- |
| status | `health`, `status` |
| agents | `agents.list`, `agents.create`, `agents.update`, `agents.delete` |
| agent config docs | `agents.files.list`, `agents.files.get`, `agents.files.set` |
| sessions | `sessions.list`, `sessions.get`, `sessions.preview` |
| messages | `chat.history`, `sessions.messages.subscribe` |
| Tavern chat registry | Tavern DB projections; Gateway adapter does not own this surface |
| Tavern chat send | Tavern Runtime `/chat`; Gateway adapter does not own this surface |
| cron | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs` |
| models | `models.list` |
| skills/tools | `skills.status`, `skills.install`, `skills.update`, `tools.catalog` |
| events | `health`, `shutdown`, `sessions.changed`, `session.message`, `session.tool`, `cron`, `chat` |

## Platform Normalization

OpenClaw is the agent runtime. Platforms such as Tavern Messenger and Discord are runtime surfaces
inside OpenClaw.
Platform-specific parsing belongs under `src/platforms/<platform>/`.

The adapter must normalize platform records before returning Tavern API records:

- Chats include typed `participants`, where each member is an Tavern agent or observed participant.
- Chats carry platform-specific source facts in typed `platformMetadata`, not in display names.
- Tavern Messenger chats use first-party Tavern chat ids and should not require transport-specific
  inference.
- Discord channel chats group by channel id across agents.
- Discord DMs group by Discord user and OpenClaw agent, because each agent has its own 1:1 DM.
- Spawned OpenClaw worker sessions inherit their parent conversation identity.
- Platform fields such as `lastTo`, `origin.to`, and Discord session key fragments stay inside the
  adapter.

For Tavern Messenger, `platformMetadata` includes Tavern chat id, optional conversation id,
observed labels, and source records. For Discord, `platformMetadata` includes account ids,
guild/channel/thread/DM facts, observed labels, and source records. Tavern owns the final display
name derived from those facts plus linked profiles.

## Send Routing

Tavern sends messages to OpenClaw through Tavern Runtime's private Tavern Messenger relay by session
key. For v1 Tavern chats, each chat has exactly one bound runtime agent and Tavern Server passes
that agent's synced session key in `target.sessionKey`. The Gateway adapter rejects public Tavern
chat registry and send operations; it does not derive Discord channel, Discord DM, opaque OpenClaw
session keys, or generic OpenClaw `sessions.send` payloads from chat targets.

## Captured Sample Tests

Mapper tests should use sanitized samples derived from real OpenClaw Gateway responses. Keep raw
captures under `.context/openclaw-captures/` and checked-in sanitized shapes under
`src/test-data/`. Do not fabricate required ids, schedules, timestamps, or file contents in
mappers; fail the mapping when Gateway data is missing a required protocol field.

## Mapper Organization

Mapper files are grouped by Tavern primitive and operation:

```txt
src/mappers/
  agents/list.ts
  agents/get.ts
  agents/upsert.ts
  agents/delete.ts
  agents/files.ts
  cron/list.ts
  cron/create.ts
  sessions/messages.ts
src/platforms/
  discord/conversation.ts
  discord/participant.ts
```

Each file should export one mapping operation. Domain-local shared helpers belong in
`mappers/<domain>/shared.ts`.

## Known Protocol Questions

- OpenClaw Gateway auth requires a signed device identity for paired gateways. This package accepts
  a signing callback instead of owning private keys or secret storage.
- Tavern sessions intentionally do not expose Claude/Codex/OpenCode execution backend. That detail
  can remain runtime-native metadata unless a product surface needs it.
- Tavern memory settings are Tavern Runtime-owned. OpenClaw Gateway is not expected to implement
  Tavern memory settings.
- OpenClaw Gateway exposes local skill inventory through `skills.status`. Its `skills.detail`
  method is ClawHub discovery metadata, not the selected local `SKILL.md` content, so Tavern marks
  skill file content unavailable until Gateway exposes a local skill-content RPC.
