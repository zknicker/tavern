# AGENTS.md

This file is the always-on guide for AI coding assistants in Tavern.

## Repository Snapshot

- Monorepo with the backend in `apps/server`, the app client in `apps/website`, the Tavern
  Runtime in `apps/runtime`, and Tavern API contracts in `packages/tavern-api`.
- Product scope is Tavern Runtime config, runtime observability, planning, and context across
  agents, chats, sessions, logs, memories, spawned agents, and cron jobs.

## Runtime Mental Model

- Use the product nouns directly when reasoning about runtime behavior: `chat`, `session`, and
  `turn`.
- A `chat` is the durable conversation container.
- A `session` is one runtime agent's durable conversation or execution record inside a chat.
- A `turn` is one execution inside a session.
- Agent runtimes own native execution, sessions, turns, runtime transcripts, files, tools, model
  calls, and runtime config.
- Tavern Runtime owns the chat server product model: chats, messages, participants, per-chat
  sequence, events, reads, soft deletes, automations, deliveries, and runtime activity.
- Tavern App owns the first-party client, cache, local presentation, profiles, participant links,
  and app settings.
- Normal chat work should use Tavern chats and Tavern message identity first. Runtime session keys
  are delivery/execution metadata for the selected agent, not the product timeline identity.
- For OpenClaw-backed sessions, Tavern `session.key` is the raw OpenClaw `sessionKey`; Tavern
  `session.id` is the OpenClaw `sessionId`, the current transcript identity behind that key.
- APIs that fetch, resync, route, or send to a continuing session should name the lookup input
  `sessionKey`, not `id`.
- Cron execution is runtime-owned. Tavern projects cron job config and cron run history, and may
  show delivery into a configured destination chat when the runtime reports it.
- Avoid introducing vague umbrella terms such as `execution context` in explanations or API design
  when `chat`, `session`, `turn`, `execution`, or `delivery` would be more precise.
- Platforms such as Discord, Telegram, Slack, and iMessage are runtime/platform facts. Runtime
  adapters normalize them into Tavern chats, sessions, messages, and participants before product
  code sees them.
- Runtime adapters do not author final Tavern display names. They project stable primitive ids,
  typed participants, bindings, session keys, and typed `platformMetadata`.
- Tavern chat history should be canonical Tavern Runtime state.
- Runtime-projected message history is execution evidence for a session.
- The app reads chat history through Tavern API reads backed by Runtime. Current session projection
  reads are a transition path, not the target canonical chat store.
- Runtime owns volatile in-flight reply state when the runtime exposes it.
- Volatile reply state must not become a second durable chat history.
- Optimistic chat UI belongs in the app. It is app-local presentation state, not durable history.
- The app may optimistically show an accepted user message immediately, but active reply indicators
  should come from runtime status/event surfaces when supported.
- Keep optimistic user message rows in app-local state. Do not patch `chat.log.list` to show them.
- The app may keep app-local `timelineStates` that combine logged rows and reply state for one-frame
  chat handoffs. That state is presentation-only and must not become durable history.
- Do not immediately refetch or invalidate durable chat history just to show an app-local
  optimistic message row. Let logged history replace it when that data arrives.
- Do not describe app-local optimistic rows or active reply indicators as chat history sync,
  logging, or durable message persistence.

## Test Chat Hygiene

- Prefer the website e2e mock runtime or unit/integration tests over manual smoke chats in a real
  local runtime.
- When manual validation must create real Tavern chats, use an obvious temporary first message such
  as `Codex smoke <timestamp>: <purpose>`, record the created chat ids, and delete only those chats
  before finishing the task.
- If a run fails before cleanup, report the exact chat ids or titles left behind so the operator can
  remove them. Do not delete pre-existing chats or broad groups of rows unless the user explicitly
  asks for that data cleanup.

## Dashboard Data Model

- Treat the dashboard as sync-first UI. It should render the best already-synced data we have even
  when no runtime is configured or the runtime is offline.
- Treat Tavern-owned config as canonical local state. Do not add recurring provider-to-Tavern sync
  for domains Tavern owns.
- Prefer database-backed entity queries over broad dashboard payloads. Reach for focused reads such
  as agents, sessions, jobs, events, and memories before adding new aggregate dashboard shapes.
- Keep hooks and queries record-oriented. Prefer fetching a single record by id; when multiple
  records are needed, prefer identifiers or lightweight summaries. Do not fetch large mutable
  arrays of full records and then drive updates by scanning and replacing them client-side.
- Keep persistent synced data separate from volatile runtime state. Do not attach high-churn fields
  to shared records that are consumed app-wide when a narrower query can expose that activity.
- Treat the runtime as an event sync transport and freshness signal, not as a navigation or
  rendering precondition for dashboard routes.
- Reserve background runtime sync for observed runtime state such as sessions, logs, workers, and
  cron runs.
- Runtime connection state should stay in a focused hook or small UI surface such as a badge. Do
  not introduce full-page runtime loading gates for dashboard pages.
- When the runtime reconnects, use it to refresh synced data rather than replacing the dashboard
  with runtime-specific blocking states.
- In React dashboard routes, prefer Suspense-first loading. Let page or module boundaries render
  skeletons while hooks suspend.
- Keep hooks data-first. Avoid threading loading booleans through view props when Suspense can own
  the loading state.
- Treat empty synced database results as valid rendered states. Suspend on the initial cache miss,
  not on background refresh.

## Agent Runtime Projections

- Agent runtime adapters should project Tavern primitives plus source facts. Do not let adapter code
  author final Tavern presentation.
- Runtime adapter records must not include final chat names or fake chat workspace folders.
  Chat labels are Tavern presentation derived from typed primitives.
- Put platform-specific chat facts in typed `platformMetadata`, such as Discord guild, channel,
  thread, DM user, account, observed-label, and source-record facts. Keep `metadata` for projection
  bookkeeping such as synced session keys.
- Preserve participant source labels as observed labels. Do not merge participants by display name;
  profile-to-participant linking is explicit Tavern-owned state.
- Message sends to agent runtimes must use a synced session key for the selected agent/chat pair.
  Do not derive Discord channel, Discord DM, or opaque runtime session keys from chat targets.
- If a runtime record is missing a required stable id, timestamp, schedule, file content, or actor,
  fail the mapping or mark the capability degraded instead of inventing a value.
- Runtime session labels may be absent. Preserve that as `null` in the adapter record and derive
  user-facing session titles at the server/view-model boundary.

## API Structure

1. Server tRPC features live in `apps/server/src/api/<feature>/`.
2. Each feature should expose a `router.ts` plus one file per procedure, such as `get.ts` or
   `create.ts`.
3. The root application router lives at `apps/server/src/api/router.ts`.
4. Prefer feature routers that map to a single entity or capability. Avoid page-shaped aggregate
   procedures when the UI can compose focused reads.
5. Keep API procedures thin. Move business logic into product-owned server modules.
6. Keep external-system code behind integration adapters. Do not let integration buckets own
   product domains.

## Event Flow

- Define server-to-client invalidation events in `apps/server/src/api/invalidation-events.ts`.
- Expose websocket subscriptions as named domain events, not generic event buckets. Prefer
  subscriptions such as `chat.onTurnStarted` or `agent.onUpdate` over transport-shaped endpoints.
- Keep tRPC websocket subscriptions thin in feature routers. They should forward one event or one
  tightly scoped event family.
- Keep app event listeners in dedicated hooks that own the client-side tRPC subscription and
  the exact React Query invalidation or cache update for that event, then mount them near the
  shared provider.

## Always-On Coding Rules

1. Keep TypeScript strictness enabled.
2. Follow the repo-standard Ultracite and Biome config. Use `bun run lint` and do not restate
   formatting rules in code.
3. Build types first before implementation details.
4. Make illegal states unrepresentable with narrow unions and runtime validation.
5. Keep modules focused and composable; split files when responsibilities diverge.
6. Keep files under `300` LoC, excluding generated files.
7. When a file grows past roughly `200` LoC or starts mixing multiple concerns, split it into a
   small feature folder before adding more surface area.
8. Keep main exports and the core flow near the top; keep local helpers near the bottom.
9. Avoid unnecessary barrel files. Use them only for clear package or domain entrypoints.
10. Prefer immutable patterns and explicit validation at boundaries.
11. Handle edge cases and external failures explicitly; do not swallow errors.
12. Add or update focused tests when behavior changes.
13. Keep comments, docs, and user-facing text short and in plain product language.
14. In React code, keep route components thin and move reusable logic into focused hooks.
15. Wrap tRPC React Query calls in hooks instead of calling tRPC directly from components.
16. Keep `apps/website/src/hooks` organized by product capability for app-level hooks;
    colocate only truly feature-specific hooks with the feature they serve.
17. Keep hooks granular and capability-first. Promote platform concepts to top-level domain areas
    such as `hooks/sessions` or `components/channels` even with one consumer; keep feature folders
    for workflow-specific composition.
18. Effects are for external synchronization, not derived state.
19. When using TanStack React Form, treat fetched records as mount-time form snapshots. Prefer
    gating edit forms on record load and remounting from explicit snapshot keys over syncing remote
    data into a mounted form with effects.
20. In TanStack React Form UIs, prefer field-level bindings in the leaf components over prop
    drilling whole form value objects and generic change handlers through the tree.
21. Keep components mostly presentational; put data access, invalidation, optimistic behavior, and
    orchestration in the hook or module that owns the capability.
22. Pass small domain props or local view models, not entire query objects or large page-hook
    return bags.
23. Let server data stay the source of truth. Use optimistic UI only when the product needs it and
    rollback behavior is explicit.
24. Prefer inferred types from router outputs and hook return values over hand-written shared view
    types.
25. On the server, organize code by product capability first. Keep `api/` thin, keep domain logic
    under product nouns, keep app-specific integration code in `adapters/`, and push cross-boundary
    first-party contracts into `packages/tavern-api`.
26. Keep server contracts with the domain that owns them, such as `sessions/contracts.ts` or
    `agents/contracts.ts`. Do not let generic integration barrels become the active owner.
27. Keep subscription procedures in the same router namespace as the queries they affect.
28. For app events, define one named tRPC subscription per event or tightly scoped event family,
    then wrap it in a dedicated app hook that owns invalidation or cache updates. Do not route
    unrelated client behavior through one generic subscription and switch on event type in
    components.

## React Page Structure

- Route files should be the real page assembly. Do not add thin pass-through page wrappers that
  only render a second page component with no meaningful logic.
- Build pages from small, focused components. Prefer `1-3` simple props such as ids, flags, or
  labels; avoid large prop bags, large render functions, and page-sized components with many
  sections or conditionals.
- Keep query ownership, mutations, and local state close to the UI slice they affect. Do not use
  page-level megahooks that centralize unrelated reactive state, and keep rerenders scoped to one
  focused part of the tree when possible.

## Naming Rules

1. Use concise, explicit names in product language without filler or implementation detail.
2. Use verb-first names for jobs, procedures, and services.
3. Avoid vague or overly technical names such as `provider`, `manager`, `helper`, or `data` when a
   domain term exists.
4. Prefer short names scoped by directories over long prefixed filenames.
5. Align route, procedure, filename, and exported symbol names semantically.
6. Keep service and utility files single-purpose.
7. Use kebab-case file names.
8. Name API features after the client-facing capability, not an internal integration bucket.
9. Name hooks and components after the capability or UI primitive they expose, not the page or
   transport that happens to use them.
10. Prefer `cron` and `modelAccess` over integration-shaped names such as `openClaw` or
   `aiProviders` at the app boundary.

## Change Scope Rules

1. Prefer the simplest end-to-end change that resolves the requirement.
2. Promote code to a top-level domain area as soon as it represents a product or platform concept;
   do not wait for a second call site when the ownership is already clear.
3. Do not add extension points or abstractions unless they are needed now.
4. Treat the codebase as work in progress; prefer the correct target design over preserving weak
   stubs.
5. Do not add legacy compatibility code, fallback branches, or schema-normalization paths for
   first-party Tavern changes just to preserve older local state.
6. If existing local data or schema blocks the ideal design, prefer an explicit operator step such
   as a direct database migration or data reset. Ask before deleting user data.
7. Prefer COSS UI components backed by Base UI for shared app primitives; do not add new
   shadcn or Radix UI usage.
8. Follow `DESIGN.md` for visual design decisions, especially token usage, settings layout, and
   shared component behavior.
9. When cross-boundary runtime, admin, or product contracts change, update `packages/tavern-api`
   directly for the current first-party contract. Do not add legacy fallbacks, compatibility
   branches, or client migration layers for older runtime behavior. Tavern is the only client we
   need to optimize for.
10. Treat `apps/server/src/db/bootstrap.ts` as fresh-schema setup only. For database migrations,
   directly edit the local SQLite database instead of adding migration code.

## Required Maintenance

1. Keep docs current when API shape, storage models, frontend structure, or remote connection
   assumptions change.
2. Keep startup status logging intact in the server entrypoint when adding features.
3. Keep secrets out of version control.
4. Update `.env.example` when environment variables change.
5. Keep docs anchored to source-of-truth code and config. Do not mirror executable facts in prose.
6. If requirements are unclear, update the relevant spec and ask.

## OpenClaw Plugin Development

- Tavern Runtime owns the local first-party plugin lifecycle for managed OpenClaw.
- Dev stack startup builds `packages/tavern-openclaw-messenger` and
  `packages/tavern-openclaw-cortex`, and `packages/tavern-openclaw-workspace`,
  then Runtime syncs them into `/Users/zknicker/.tavern/openclaw-plugins/` before
  launching managed OpenClaw.
- Do not restart or deploy to the global `~/.openclaw` Gateway for local Tavern Runtime work; it
  conflicts with the managed Gateway port.
- For changes under first-party OpenClaw plugin packages, run the normal runtime dev stack or
  `bun run --filter @tavern/runtime build` to verify the plugin lifecycle. Do not use a separate
  local plugin deploy command.

## OpenClaw Contract Debugging

- Tavern supports one runtime product, OpenClaw. Treat OpenClaw's shipped web/operator behavior as
  the contract when debugging Gateway method, event, chat, session, or turn semantics.
- Use the shipped OpenClaw web surfaces that answer the specific question at hand:
  - public Gateway method list in the installed `node_modules/openclaw/dist/server-methods-list-*.js`
  - relevant web docs under `node_modules/openclaw/docs/web/*`
  - targeted Gateway/runtime bundle inspection only when a concrete contract ambiguity remains
- Do not treat unrelated client docs or surfaces, such as Android, as authoritative for Tavern's
  web/runtime integration behavior.
- This is a contract-debugging workflow, not a required step for every routine OpenClaw code
  change. Use it when method/event semantics, delivery behavior, or Gateway capabilities are the
  thing being changed or verified.
- When Tavern depends on a specific Gateway RPC, event shape, or delivery behavior, add or update a
  focused test that proves it from raw Gateway frames or the shipped method list instead of relying
  on memory.
- If OpenClaw later ships a better typed SDK, exported contract surface, or clearer official docs,
  update this section plus `docs/operations/testing.md` and `apps/website/e2e/README.md` so future
  agents use the newer source of truth instead of stale reverse-engineering guidance.

## Knowledge Index

- Product behavior and primitive definitions: `specs/README.md`
- OpenClaw runtime behavior: `specs/agent-runtimes/README.md`
- Docs front door and policy: `docs/README.md`, `docs/docs-policy.md`
- Product feature docs: `docs/features/README.md`
- Tavern API contracts: `docs/api/README.md`
- TypeScript SDK: `docs/sdk.md`
- Architecture overview: `docs/internals/architecture-overview.md`
- Data model: `docs/internals/data-model.md`
- Frontend structure and ownership: `docs/internals/frontend.md`
- Visual design system and UI principles: `DESIGN.md`
- App backend structure and ownership: `docs/internals/app.md`
- App and Runtime boundary: `docs/internals/runtime.md`
- Tavern OpenClaw plugin lifecycle: `docs/operations/openclaw-plugin-deploy.md`
- Testing strategy and runtime test rules: `docs/operations/testing.md`
- Website e2e harness boundary and mock runtime rules: `apps/website/e2e/README.md`
- React conventions: `docs/internals/react.md`
