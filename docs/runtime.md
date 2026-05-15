# Tavern Runtime

Tavern Runtime is the Tavern-owned service for memory, task storage, local projections, sync jobs,
and agent-facing Tavern tools. It is not OpenClaw and it is not a replacement agent executor.

Tavern currently supports exactly one agent runtime: OpenClaw. Tavern keeps its own runtime
protocol and product nouns so the Tavern product model stays stable and insulated from OpenClaw
design details, but the only implemented runtime today is OpenClaw.

## Ownership

- Tavern Runtime owns Tavern memory, embeddings/search, Tavern Vault credentials, the enabled model
  catalog, knowledge/task systems, Tavern-local preferences, profiles, participant links, local
  projections, sync jobs, and MCP/tool APIs that OpenClaw agents call into.
- OpenClaw owns native runtime records and execution behavior: agents, turns, sessions, cron,
  messages, files, tools, platform channels, and the applied OpenClaw config document.
- Tavern owns the generated OpenClaw config policy. Runtime writes the full managed config from
  Tavern state and only exposes product settings for the config fields Tavern intentionally owns.
- Tavern Runtime owns Tavern-managed skill packages, the `~/.tavern/skills` registry/cache, and
  materialization of selected skills into each OpenClaw agent workspace.
- Tavern Runtime launches managed OpenClaw with macOS Seatbelt guardrails. Tavern does not build or
  manage per-agent Docker sandbox images, and the default local mode does not claim container-style
  isolation.
- Tavern skill product APIs expose Tavern-managed packages only. OpenClaw bundled/runtime skill
  source categories are adapter facts, not Tavern product fields.
- Tavern Runtime owns the local OpenClaw Gateway adapter and translates Gateway records into Tavern
  primitives.
- Tavern Runtime owns the OpenClaw install, version selection, Gateway launch, local OpenClaw state
  root, generated config, and Seatbelt guardrail policy.
- Tavern Runtime may store projections of OpenClaw-owned records for search, browse, and offline
  observability, but OpenClaw remains canonical.
- Skill materialization requires Tavern Runtime to run on the same host as OpenClaw, with writable
  access to the managed OpenClaw workspace and every selected agent workspace.

## Tavern-Owned Data

- memory records
- memory extraction and persistence jobs
- Tavern Vault provider credentials
- enabled model catalog and provider access settings
- knowledge/task records that are not native OpenClaw jobs
- Tavern Runtime URL and health settings
- Tavern-managed skill packages and per-agent skill selections
- synced projections and `last_synced_at`
- profile settings and manual profile-to-participant links
- Tavern presentation metadata such as agent color/avatar overrides

## OpenClaw-Owned Data

OpenClaw owns these records even when Tavern stores projections:

- `agent`
- `chat`
- `session`
- `turn`
- `cron`
- `log`
- `message`
- OpenClaw-native skill eligibility/status
- `agent file`
- OpenClaw-native model/config records after Tavern Runtime applies its generated config

## Layers

- Tavern App
  The UI for configuring the Tavern Runtime URL.
- Tavern Runtime
  Tavern-owned service for memory, tasks, projections, sync, agent-facing tools, and local
  OpenClaw Gateway communication.
- OpenClaw Gateway adapter
  The Runtime-local translation layer between OpenClaw Gateway RPC/events and Tavern primitives.
- OpenClaw
  The colocated runtime that owns native execution.

## Runtime Health

Tavern connects to one Tavern Runtime. Tavern Runtime connects to local OpenClaw Gateway on the
same host.

- Tavern does not support multiple runtime products today. The single supported runtime product is
  OpenClaw.
- Tavern does not support multiple simultaneously active runtime backends behind one product
  surface. The runtime protocol remains separate so Tavern can preserve its own boundary and
  potentially switch runtimes in the future without rewriting product primitives.

- The app stores one Tavern Runtime endpoint for server-to-runtime transport. It does not expose
  separate OpenClaw Gateway records, runtime choices, or runtime delete/select actions.
- Environment setup may provide `TAVERN_RUNTIME_URL`.
- The settings surface presents Tavern Runtime health and managed OpenClaw capabilities.
- Runtime health is the Tavern Runtime service health. OpenClaw Gateway health is a separate
  OpenClaw capability reported by the runtime.
- Tavern Messenger remains the OpenClaw plugin for Tavern-native chat delivery.
- Tavern Server does not read OpenClaw databases, config files, or identity files directly during
  normal product operation. Tavern Runtime generates the managed OpenClaw config and passes the
  generated Gateway token to its adapter.
- Tavern Runtime does write selected Tavern-managed skills into OpenClaw agent workspace `skills/`
  directories. Runtime and OpenClaw must be colocated so workspace paths are local and writable from
  Tavern Runtime.

See `../specs/agent-runtimes/tavern-messenger.md` for the Tavern Messenger chat flow diagram.

## Development Stack

The normal local development stack is:

```txt
bun run dev
  -> apps/runtime dev server
  -> apps/runtime starts the pinned OpenClaw Gateway
  -> apps/server dev server
  -> apps/website Vite dev server
  -> apps/runtime connects to managed OpenClaw Gateway at ws://127.0.0.1:18789
```

OpenClaw is always started by Tavern Runtime. The root `openclaw` dev dependency pins the
compatible version for this repo. Runtime startup resolves the version from
`TAVERN_OPENCLAW_VERSION`, then the root package pin, then the runtime fallback constant. It uses
only the shared runtime npm cache at `~/.tavern/runtime/openclaw/versions/<version>`.

The first run on a machine may download the pinned OpenClaw npm package into the shared cache.
Worktrees reuse that cache and do not each get a separate OpenClaw install. Tavern Runtime does not
use a global OpenClaw install, a repo `node_modules/.bin/openclaw`, or an externally managed
Gateway.

Managed OpenClaw state is under `~/.tavern/runtime/openclaw`:

```txt
~/.tavern/runtime/openclaw/versions/<version>/   # reinstallable npm cache
~/.tavern/runtime/openclaw/run/openclaw.json     # generated Gateway config
~/.tavern/runtime/openclaw/run/state/            # disposable OpenClaw runtime state
~/.tavern/runtime/openclaw/run/workspace/        # disposable default managed workspace
```

Tavern Runtime generates the Gateway token and config for the managed Gateway, then exports
`OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_CONFIG_PATH`, and
`OPENCLAW_STATE_DIR` to its own Gateway adapter process environment. Tavern Server only needs the
Tavern Runtime URL:

```bash
TAVERN_RUNTIME_URL=http://127.0.0.1:4310 \
bun run dev
```

If those values live in `.env`, the command can be shortened to:

```bash
bun run dev
```

See `docs/openclaw-runtime-upgrade.md` for the managed OpenClaw version bump and state migration
process.

Managed OpenClaw requires macOS Seatbelt. Runtime startup fails if `sandbox-exec` cannot launch the
Gateway. Tavern runs OpenClaw as the current user with the normal user environment, including the
user's `HOME`; Seatbelt is a guardrail, not a container. The current profile preserves OpenClaw
compatibility, including child processes and normal package-manager work such as npm installs,
while blocking direct access to high-risk home secret paths such as SSH, AWS, GnuPG, Kubernetes,
keychain, and iCloud document roots. Strong isolation belongs in Docker, a VM, a separate macOS
user, or a separate machine.

Managed local development builds Tavern Messenger from `packages/tavern-openclaw-messenger`, syncs
it into `~/.tavern/openclaw-plugins/tavern-openclaw-messenger` before launching OpenClaw, then
loads that stable managed plugin path in the generated OpenClaw config. `TAVERN_OPENCLAW_PLUGIN_PATH`
can override the loaded plugin path, and `TAVERN_OPENCLAW_PLUGIN_DEPLOY_PATH` can override the
managed copy target. Runtime health records the installed plugin as the `tavernPlugin` capability.

## Persistence

- Tavern Runtime stores its local database at `DATABASE_PATH`, defaulting to
  `~/.tavern/tavern.sqlite`.
- Tavern-owned memory state belongs under Tavern Runtime storage.
- `~/.tavern` is the backup unit. It contains Tavern's durable database, memory, vault, managed
  skill packages, runtime settings, and projected OpenClaw archives.
- Managed OpenClaw install bytes are cached by exact version under
  `~/.tavern/runtime/openclaw/versions`. They are rebuildable and do not need to be treated as
  durable user data.
- Managed OpenClaw runtime state and generated config live under
  `~/.tavern/runtime/openclaw/run`. This directory may be deleted and recreated; Tavern should
  regenerate config and resync current runtime state while keeping existing projected archives in
  the Tavern database.
- OpenClaw-owned records that Tavern renders relationally are stored as synced projections with
  `last_synced_at`; OpenClaw remains the source of truth.
- Projection rows use the stable runtime namespace `tavern-openclaw-managed`. This is a local
  projection namespace, not a user-visible connection id, and it must remain stable across managed
  OpenClaw reinstall/reset so archived projections stay visible.
- OpenClaw config should be generated from Tavern-owned state by Tavern Runtime. The old server-side
  config snapshot/fixup path is transitional and should be reduced to compatibility reads or removed
  as settings move to Tavern-owned config surfaces.
- Tavern-owned provider credentials, model catalog records, and memory settings are stored in
  Tavern Runtime. Transport of these facts to OpenClaw is derived from Tavern-owned state.
- OpenClaw native installed agents, cron definitions, sessions, and provider-specific execution
  state stay with OpenClaw and are projected into Tavern for archive/search/offline display.
- Tavern-managed skill packages are stored under `~/.tavern/skills`. Selected packages are copied
  into `<workspace>/skills`, where Tavern owns the directory contents and writes marker files.
- Skill secrets are stored per skill in Tavern Vault. Runtime config materialization should expose
  only the selected values Tavern intentionally grants to managed OpenClaw.
- Tavern Runtime checks installed ClawHub skill packages for newer published versions with the
  registered `check-skill-updates` job. The job checks only packages Tavern has installed, runs
  requests serially, respects ClawHub rate-limit headers, and records latest version/check status on
  the skill package record.
- Repository paths under `apps/runtime` are source and bundled development assets only.

## Flow

1. The app sends Tavern-owned reads and writes to Tavern Server.
2. Tavern Server calls the configured Tavern Runtime for OpenClaw-owned data.
3. The OpenClaw Gateway adapter reads or mutates OpenClaw-owned resources.
4. OpenClaw applies the change in its native store.
5. The OpenClaw Gateway adapter emits supported events.
6. Tavern Runtime treats events as invalidation and freshness signals.
7. Scheduled Tavern jobs and targeted event handlers invoke primitive sync paths.
8. Primitive sync paths update local projections and `sync_state`.
9. The app renders from Tavern reads backed by React Query and local projections.

## Sync Paths

Each OpenClaw-owned primitive has one server-side sync path. Jobs, websocket events, manual
refreshes, and post-edit refreshes reuse that path instead of duplicating Gateway fetch logic.

- `agent` sync stores current OpenClaw agents in `agents` for `tavern-openclaw-managed`.
- `chat` sync stores current OpenClaw/Tavern Messenger chats in `chats` for
  `tavern-openclaw-managed`.
- `session` sync stores OpenClaw sessions in `session_runs` and keeps old observed sessions unless
  OpenClaw explicitly deletes them.
- `message` sync stores OpenClaw history in `session_messages` and child tables. Bounded sync
  deletes absent rows only inside the fetched message timestamp window.
- `cron` sync stores OpenClaw cron config in `cron_jobs` and removes missing rows for OpenClaw.
- `cron run` sync stores observed run history in `cron_runs` and keeps old runs.
- Managed config is generated by Tavern Runtime. Any remaining `config` sync is diagnostic or
  transitional, not Tavern's canonical settings model.

Product APIs should read these projections by default, including derived UI helpers such as agent
activity, worker/subagent lists, and cron delivery target options. Live OpenClaw reads are reserved
for file browsing, turn execution, health checks, and sync paths. Settings edits should update
Tavern-owned config state that Runtime uses to regenerate/apply OpenClaw config.

## Protocol Boundary

- Remote execution communication goes through Tavern Runtime.
- The adapter normalizes platform-specific facts into Tavern primitives before product code sees
  them.
- The adapter normalizes OpenClaw Gateway events into `AgentRuntimeEvent` records.
- The browser app should not import `packages/agent-runtime-protocol` for product screens; it uses
  app/runtime APIs and local hooks.
