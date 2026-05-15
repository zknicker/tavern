# App

Tavern organizes backend code by product ownership, not by transport or integration.

See also `docs/runtime.md` and `docs/domains.md`.

## Top-Level Areas

- `api/`
  Thin tRPC routers and procedures only.
- `api/agent-runtime/`
  The public Tavern server surface for observing Tavern Runtime health and managed runtime
  capabilities.
- product domains
  Product-owned server logic such as `agents`, `participants`, `chats`, `sessions`, `cron`,
  `workers`, `jobs`, `memories`, and `models`.
- Runtime health
  Tavern Runtime client creation, health checks, event subscriptions, sync triggers, and supported
  OpenClaw actions under `agent-runtime/`.
- Runtime storage
  Tavern Runtime endpoint, reachability, namespace, and sync status in dedicated storage modules.
- integration adapters
  App-specific external-system glue under `adapters/`, such as memory or webhook integrations.
- shared packages
  Portable first-party contracts in packages such as `packages/agent-runtime-protocol`.
- persistence
  Database schema, repositories, and storage readers or writers.

## Ownership Rules

- Keep `api/<feature>` thin. Procedures should validate input, call a domain function, and return
  a result.
- Keep runtime-facing tRPC procedures under capability routers, not integration-shaped names or
  selectable connection APIs.
- Keep the server-to-runtime boundary aligned with `docs/runtime.md`.
- For config domains owned by OpenClaw, keep server writes against Tavern Runtime and
  store local tables as projections with `runtime_id` and `last_synced_at`.
- Run runtime projection sync through registered jobs so Settings -> Jobs shows what synced and
  when it failed.
- Keep desktop build, notarization, updater, and S3 publishing steps in `docs/releases.md`.
- Keep projection reads and runtime writes separate. Product list/detail reads should prefer local
  projection tables; mutation procedures call the runtime, apply the returned record to the
  projection, and enqueue the relevant sync job.
- OpenClaw websocket events should enqueue focused sync jobs or invoke focused sync paths. Do not
  make app routes depend on websocket payloads as their only source of data.
- Profiles are app-owned overlay state. Use them for Tavern display name, avatar, accent color,
  and self identity.
- OpenClaw-projected chat participants should flow into `participants` and `participant_labels`
  from the server sync path. The OpenClaw adapter exposes typed chat participants and keeps
  platform-specific parsing inside adapter modules.
- Platform details such as Discord targets, direct-message rules, sender labels, and session-key
  fragments should be normalized by the runtime adapter before they reach app/domain code.
- Keep one self profile for the app user. Native Tavern chat may resolve user turns to
  `profile:self`; external observed participants remain separate records.
- Linking observed participants to the self profile is manual. Before linking, reads may use the
  best observed label; after linking, reads should prefer the profile presentation.
- Keep chat send flow product-owned in `chats` or `chat/`, with `agent-runtime/` limited to
  OpenClaw client calls such as posting messages and reading Gateway status.
- Keep durable chat history and volatile chat status separate. Use `chat.log.list` for synced
  history and `chat.status.list` for runtime-owned in-flight reply state.
- Keep optimistic user rows in app-local state. Do not patch `chat.log.list` to show them.
- The app may keep app-local `timelineStates` to combine logged rows and reply state for one-frame
  chat UI handoffs.
- Keep product logic under product nouns. Do not let integration folders become the owner of
  sessions, cron, models, or other first-class domains.
- Persist canonical chat semantics such as conversation kind in the chat domain itself during sync
  or projection. Do not re-infer DM or channel identity in app components.
- Keep domain contracts with the domain that owns them. Prefer files such as
  `sessions/contracts.ts`, `agents/contracts.ts`, or focused OpenClaw runtime contracts over
  generic integration-wide contract barrels.
- Keep OpenClaw client code thin and focused under `agent-runtime/`. Do not let it become the owner
  of agents, chats, cron, or other product domains.
- Keep OpenClaw Gateway details and plugin-specific branching inside adapter packages. Product
  domains should not inspect Gateway payloads.
- Keep app-specific integration glue under `adapters/`.
- Keep first-party OpenClaw-facing primitive contracts in `packages/agent-runtime-protocol`.
- Fan large modules out into a directory with a thin `index.ts` or service entrypoint plus focused
  helpers.
- Name SQLite tables and indexes with product terms such as `agents`, `cron_jobs`, `workers`, or
  `logs`, not integration-prefixed names. Attach runtime ownership with columns instead of table
  prefixes.

## Projection Layout

- `agents`: runtime agent list plus Tavern presentation overlays.
- `chats`: runtime chat/channel binding config.
- `profiles`: Tavern-owned profile presentation.
- `participants`: runtime-observed provider identities.
- `participant_labels`: observed display labels for provider identities.
- `profile_participants`: manual links from observed participants to Tavern profiles.
- `session_runs`: runtime session index and raw session payloads. For OpenClaw, `session_key` is
  the raw OpenClaw `sessionKey` used for routing and lookup; `session_id` is the current OpenClaw
  transcript `sessionId` surfaced as Tavern `session.id`.
- `session_messages`, `session_message_parts`, `session_tool_calls`, `session_links`, and
  `session_artifacts`: observed runtime session history.
- `cron_jobs`: runtime cron config.
- `cron_runs`: observed cron execution history.
- `sync_state`: primitive-level freshness and errors for runtime sync paths.

## Examples

- Good:
  `api/cron/router.ts`
- Good:
  `api/model-access/get.ts`
- Good:
  `sessions/list.ts`
- Good:
  `agents/activity.ts`
- Good:
  `workers/list.ts`
- Good:
  `agent-runtime/client.ts`
- Good:
  `agent-runtime/event-sync.ts`
- Good:
  `agent-runtime/configured-client.ts`
- Bad:
  `api/integrations/cron/router.ts`
- Bad:
  `ai-providers/service.ts`
