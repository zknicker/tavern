# Hermes Gateway

Tavern integrates with Hermes through Hermes Gateway's native WebSocket operator protocol. The
gateway is the source of truth for Tavern's Hermes integration; Tavern does not compare gateway
payloads against raw Hermes files or CLI output during normal operation.

Tavern currently supports one runtime product, Hermes. The separate Tavern runtime protocol is a
product boundary, not evidence of multiple live runtime integrations.

## Shape

```txt
Tavern Runtime
  -> @tavern/hermes-gateway-adapter
  -> local Hermes Gateway WebSocket RPC
```

Tavern App does not fork Hermes, read `~/.hermes` directly, or shell out to the `hermes`
CLI for normal product operations. Tavern Runtime owns the default local Hermes install and
Gateway process lifecycle. It may launch the pinned `hermes` binary, generate run-scoped
Hermes config, read the managed config for the Gateway token, and stop the managed Gateway during
runtime shutdown.

## Package

`packages/hermes-gateway-adapter` owns the Hermes-specific adapter.

- `src/gateway/*` contains raw Hermes WebSocket RPC, auth, events, and error handling.
- `src/agent-runtime/*` exposes Tavern runtime client behavior.
- `src/mappers/<domain>/<operation>.ts` maps Hermes payloads into Tavern API and runtime
  evidence records.
- Mappers use one operation per file, such as `mappers/agents/list.ts`.
- `src/platforms/<platform>/*` contains platform-specific interpretation for Hermes surfaces such
  as Discord, Telegram, or Slack.

Hermes is the agent runtime. Discord is a platform inside that runtime. Tavern API and runtime
evidence records must not expose Hermes/Discord parsing details such as `lastTo`, `origin.to`, or
session key fragments.

Tavern Messenger is the Hermes channel for Tavern-originated chat. It emits first-party Tavern
facts directly. The Hermes Gateway adapter still owns the mapping from Gateway method/event
payloads into Tavern API records and runtime evidence records.

The adapter maps in two steps:

```txt
Hermes Gateway record
  -> Hermes/platform interpretation
  -> Tavern primitive mapping
```

Platform modules return normalized facts such as chat kind, stable platform conversation identity,
and typed chat participants. Primitive mappers then return Tavern API records or runtime evidence
records.

Mappers must not invent required identity, schedule, or time fields. If Hermes omits a required
stable id, schedule expression, timestamp, or actor identity, the adapter fails the mapping or
mark the capability degraded instead of fabricating values such as random ids, `default`, `main`, or
the current time.

## Auth

Tavern App stores only the Tavern Runtime endpoint. Tavern Runtime connects to the local managed
Hermes Gateway at `ws://127.0.0.1:18789` as `gateway-client`/`backend`, authenticates with the
generated local Gateway token, and does not send a device payload.

Tavern Runtime generates supported token-authenticated loopback Gateway config. The app does not
expose Hermes Gateway URLs, tokens, device identities, or pairing state.

## Managed Install

Tavern Runtime always manages Hermes because Hermes Gateway RPCs, event shapes, Tavern
Messenger behavior, and session semantics are part of Tavern's compatibility envelope.

- The root Tavern repo pins the compatible `hermes` npm version.
- Runtime startup resolves that version from `TAVERN_HERMES_VERSION`, then the root package pin,
  then the runtime fallback constant.
- Runtime installs `hermes@<version>` once into
  `~/.tavern/runtime/hermes/versions/<version>` and reuses that npm cache across worktrees.
- Runtime must not use a global Hermes install, a repo `node_modules/.bin/hermes`, a custom
  local checkout, or an externally managed Gateway for normal Tavern Runtime operation.
- Runtime writes generated Hermes config, state, and the default workspace under
  `~/.tavern/runtime/hermes/run`.
- Generated config pins Codex app-server runs to the local Codex OAuth profile when the profile can
  be derived from Codex auth. `TAVERN_HERMES_CODEX_AUTH_PROFILE_ID` overrides that profile id.
  Tavern does not copy Codex tokens into generated Hermes config.
- Runtime reports the stable id `tavern-hermes-managed` through Tavern Runtime status. This id is
  a runtime namespace and must not change when Hermes is reinstalled, reset, or upgraded.

Managed Hermes requires macOS Seatbelt. Runtime startup must fail if `sandbox-exec` cannot launch
the Gateway. Runtime launches Hermes as the current user with the normal user environment,
including the user's `HOME`; Seatbelt is a guardrail, not container isolation. The current default
policy blocks direct reads/writes for high-risk home secrets such as SSH, AWS, GnuPG, Kubernetes,
keychain, and iCloud document paths while preserving normal local app behavior. If a channel needs
additional host access, Runtime exposes that as an explicit capability or settings decision
rather than broadening the default silently.

## Managed Workspace

Tavern Runtime owns the managed Hermes workspace under
`~/.tavern/runtime/hermes/run/workspace`.

Runtime exposes Hermes-supported markdown files for Tavern-managed agents. `AGENTS.md` is managed
workspace context. `SOUL.md` is managed Hermes home identity. Runtime seeds `AGENTS.md` only when
missing and does not overwrite user-saved file content during config sync.

Agents do not edit user-authored markdown files directly. Agent-authored notes are updated through
Tavern workspace tools and may be used when Runtime seeds a missing `AGENTS.md`.

The `tavern-workspace` Hermes plugin owns generated workspace-file policy, agent notes tools, and
file-protection hooks. See [Workspace](../workspace.md) for the full contract.

## Required Mapping

- `health`, `status` -> Tavern runtime status.
- `agents.list`, `agents.create`, `agents.update`, `agents.delete` -> Tavern agents.
- `agents.files.list`, `agents.files.get`, `agents.files.set` -> Tavern agent files.
- `sessions.list`, `sessions.get`, `sessions.preview`, `chat.history` -> Tavern sessions and
  messages.
- Tavern chat registry is Tavern DB-owned and is not mapped from Gateway RPCs.
- Tavern chat message acceptance flows through Tavern Runtime's private `/chat`
  relay, not a Gateway RPC.
- `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs` -> Tavern cron.
- `models.list` -> Tavern model inventory.
- `config.get`, `config.apply` -> diagnostic/transition surfaces while managed settings move to
  Tavern-owned config state.
- `skills.status`, `skills.detail`, `skills.install`, `skills.update` -> Tavern skills.
- `logs.tail` -> runtime logs when Tavern adds a log surface for runtime gateways.

Hermes list-shaped methods may paginate. The adapter or sync path must follow authoritative
pagination for primitives where Tavern expects complete snapshots or complete observed windows.

## Config Writes

Tavern Runtime owns the generated Hermes config. Product settings update Tavern-owned
records that Runtime composes into Hermes config and applies to Gateway.

`config.get`/`config.apply` full snapshots are diagnostic surfaces. Focused Tavern-owned records
are the product source for managed settings, and Tavern Runtime composes them into Hermes config.
Tavern product settings do not call Gateway `config.patch`.

## Config Fixups

Tavern applies a small Hermes config fixup pipeline whenever it syncs or saves a valid managed
Hermes config snapshot.

Fixups are Tavern-owned guardrails over the editable Hermes config surface. They preserve
unrelated Hermes settings while enforcing the parts Tavern needs for a working managed runtime.

Fixups run in this order:

1. Gateway settings: token-authenticated loopback Gateway config.
2. Context-management settings: Hermes `memory` slot set to `none` and stale managed memory
   plugins such as `lossless-claw`, `active-memory`, and `memory-core` removed.
3. Plugin trust: required Tavern plugin trust plus configured plugin entries.
4. Agent tools: Tavern default tool policy for agents that do not already have explicit
   Hermes tool policy.

Fixups do not run against invalid Hermes config snapshots. Tavern stores invalid snapshots for
inspection and asks the operator to repair the config first.

Fixups merge rather than replace. They preserve unrelated plugin entries, plugin settings,
plugin load paths, channel config, bindings, agent-specific config, model config, and
user-managed Hermes settings outside the field they own. Managed package installs are
materialized as Hermes-native `plugins.load.paths`; install specs are Runtime-owned metadata,
not Hermes config.

When a fixup changes config, Tavern applies the full updated snapshot through `config.apply`, saves
the returned snapshot hash, syncs affected records, and emits config/model/agent invalidation
events.

## Platform Metadata

Hermes adapters return core chat fields plus typed platform metadata. Core chat fields identify
the Tavern primitive: runtime chat id, platform, scope, route, participants, bindings,
and session keys. `platformMetadata` carries source-specific facts.

For Discord, `platformMetadata.provider` is `discord` and includes:

- Discord account ids observed for the chat.
- Guild, channel, thread, and DM user ids/names when present.
- Observed labels from Gateway records.
- Source records containing the original `origin`, `deliveryContext`, `lastTo`, `lastChannel`,
  kind, chat type, display name, and session key.

Adapters do not turn those source facts into final product names. Tavern server/frontend code
owns display names, using `platformMetadata`, chat participants, and linked Tavern profiles.

For Tavern Messenger, `platformMetadata.provider` is `tavern` and includes:

- Tavern chat id and optional conversation id supplied by the channel.
- Observed labels and source records from the channel/plugin.
- Participant/source facts supplied by Tavern Messenger.
- Delivery and correlation facts needed to match optimistic rows, live reply state, and durable
  history.

Tavern metadata is complete enough that the adapter does not need to infer product meaning
from Hermes labels, Discord targets, or opaque session key fragments.

## Chat Send Routing

Tavern sends to Hermes through Tavern Messenger and a resolved session key. The synced Tavern chat
chat record stores the observed Hermes session key for the chat's single bound agent. When a user
sends, Tavern includes that non-worker session key in `ChatTarget.sessionKey`.

The Hermes adapter rejects sends without `ChatTarget.sessionKey`. It must not derive Discord
channel, Discord DM, opaque Hermes session keys, or generic `sessions.send` payloads from chat
targets. A missing session key means Tavern is not send-ready for that agent/chat pair.

## Session Identity

Tavern stores Hermes `sessionKey` values directly as Tavern session keys. Hermes `sessionId`
values identify the current transcript file behind a session key and may rotate while the
conversation bucket stays the same. The adapter must preserve `sessionId` as runtime state and must
not substitute row ids or Tavern-local ids for it. Server and website APIs that look up
or operate on a continuing session must accept `sessionKey`; Tavern session records expose
`session.id` as the Hermes `sessionId`.

## Events

Hermes events are freshness signals. Tavern persists app-facing chat, session, cron, participant,
and activity state through Runtime storage, then emits focused app invalidation events. The Tavern
App recovers by reading Runtime APIs, not by reading Hermes directly.

- `sessions.changed`, `session.message`, `session.tool` -> session invalidation. These event
  payloads must not force Tavern to fabricate a full session snapshot when Hermes has not
  supplied authoritative `sessionId` and related session fields in the event payload itself.
- `cron` -> cron job/run invalidation.
- `health`, `shutdown` -> connection health invalidation.
- `chat` and Hermes turn/item/tool streams -> runtime evidence invalidation. Tavern Messenger
  writes user-visible delivery and activity through the Tavern API, so Gateway events are not a
  second Tavern chat event stream.

## Protocol Gaps To Resolve

- Tavern events do not currently include health, chat, or generic runtime invalidation events.
  Hermes exposes those event families directly.

## Protocol Decisions

- Tavern session records do not expose Claude/Codex/OpenCode execution backend. That is
  runtime-specific session metadata, not a cross-runtime Tavern primitive.
- Model provider and execution-provider types are co-located with model contracts.
- Agent files are a first-class capability. Tavern browses and edits runtime-exposed agent
  files directly instead of assuming every runtime has `SOUL.md`, `ROLE.md`, or `IDENTITY.md`.
- Runtime chat records include typed `participants`. A participant is either a Tavern agent or an
  observed external participant with normalized source identity facts.
- Discord channel chats group by channel id across agents.
- Discord DMs group by Discord user and Hermes agent, because each agent has a separate 1:1 DM
  conversation.
- Spawned Hermes worker sessions inherit their parent conversation identity.
- Hermes Gateway samples from real responses are the preferred tests for this adapter. Sample
  coverage includes agents, agent files, sessions, chat history, cron jobs, cron runs, models,
  skills, and events.
- Raw Gateway captures stay in `.context/hermes-captures/`; sanitized checked-in samples live in
  the adapter package.
