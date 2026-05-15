# Sync Model

Tavern renders local projections while treating managed OpenClaw as canonical for the runtime
primitives it owns. OpenClaw reads in product screens should use Tavern Runtime's database-backed
read model. Gateway RPC or websocket calls are used to refresh that read model and execute turns.

## Model

- Tavern-owned state lives locally.
- OpenClaw-owned runtime state lives in managed OpenClaw.
- OpenClaw-owned primitives include native agents, external platform chat observations, cron jobs,
  sessions, messages, logs, agent files, tool settings, applied model/runtime config, and channel
  bindings.
- Tavern owns generated OpenClaw config inputs. Runtime applies them to OpenClaw.
- Tavern-owned skill packages are synced into OpenClaw workspaces as files; OpenClaw remains
  authoritative for observed skill eligibility/status.
- OpenClaw-native tools may change OpenClaw-owned records.
- Tavern refreshes projections from OpenClaw on boot, reconnect, scheduled sync, manual refresh,
  and Gateway events.
- Each primitive has one reusable sync path. Scheduled jobs, websocket events, manual refreshes,
  and post-edit refreshes all invoke that same path.
- Each sync path records primitive-level freshness in `sync_state` when per-row freshness would not
  add useful information.

## Primitive Sync Ownership

| Primitive | Runtime authority | Tavern projection | Freshness | Delete by absence |
| --- | --- | --- | --- | --- |
| `agent` | native runtime agent config | `agents` plus Tavern-owned presentation overlays | row `last_synced_at` and runtime sync state | yes, list is authoritative |
| `chat` | Tavern app chats plus runtime-observed external platform conversations | `chats` | row `last_synced_at` and runtime sync state | yes for runtime-owned external chats; no for Tavern-owned chats |
| `participant` | runtime-observed platform identity | `participants` and `participant_labels` | participant `last_seen_at` | no, manual profile links are Tavern-owned |
| `session` | runtime session index/history | `session_runs` | row `last_synced_at` inside payload and runtime sync state | no, keep observed history |
| `message` | runtime session graph/history | `session_messages` and message child tables | row `synced_at` and session sync state | only inside an authoritative fetched time window |
| `turn` | runtime live execution and events | event/log projections | runtime sync state or event timestamp | no, keep observed history |
| `cron` | runtime cron config | `cron_jobs` | row `last_synced_at` and runtime sync state | yes, list is authoritative |
| `cron run` | runtime cron history | `cron_runs` | row `synced_at` and runtime sync state | no, keep observed history |
| `config` | Tavern-generated managed config | Tavern-owned settings plus diagnostic snapshots | settings `updated_at` and optional snapshot hash | Runtime reapplies generated config |
| `agent file` | runtime filesystem/config surface | fetched live on open, optional cached metadata later | explicit refresh timestamp | runtime-specific |
| `skill package` | Tavern package registry | `skill_packages` and `agent_skill_selections` | package `updated_at` and selection `synced_at` | Tavern desired state |

`last_synced_at` belongs on rows when rows can be updated independently. Primitive-level sync state
belongs in `sync_state` when a full list is refreshed together or when per-row freshness would always
be identical.

## Projections

- Projection rows include the stable managed OpenClaw namespace `tavern-openclaw-managed`.
- Projection rows include the stable runtime id for the primitive.
- Projection rows include `last_synced_at`.
- Runtime chat projection syncs typed chat participants into observed participants and labels for
  runtime-observed external chats.
- OpenClaw Tavern sessions do not project Tavern chat rows. They project sessions, messages, and
  tool calls that attach to app-owned Tavern chats by session key.
- Runtime adapters normalize platform-specific chat and participant facts before data reaches
  Tavern projections.
- Tavern stores enough projected data to keep the app useful when a runtime is offline.
- Runtime connectivity is Tavern Runtime health/capability state, not a selectable connection model.
- Product screens compose projections from focused APIs. A missing or offline runtime should show
  stale projections with freshness/error affordances instead of replacing pages with runtime
  connection blockers.

## Managed Config

- Tavern Runtime generates managed OpenClaw config from Tavern-owned state.
- If Runtime recreates OpenClaw state, it reapplies the generated config before normal sync.
- If a runtime removes an agent or cron job from an authoritative snapshot, Tavern may remove or
  hide the matching current projection row, but observed history remains archived.
- Tavern preserves Tavern-owned overlays such as agent color and avatar presentation separately from
  runtime-owned projection rows.
- Tavern does not treat OpenClaw config files as canonical settings storage.

## Observed History

- Observed history includes sessions, messages, logs, turn events, cron run history, worker state,
  and activity.
- Observed history is useful offline.
- Observed history remains labeled as observed runtime history.
- Observed append-only history is upserted by stable runtime identifiers.
- Observed history survives managed OpenClaw reinstall/reset when `~/.tavern/tavern.sqlite` is
  preserved.
- Bounded message sync preserves older archive rows outside the fetched result window.
- When a runtime returns messages for a concrete timestamp window, Tavern deletes local message rows
  in that same window if their stable ids are absent from the runtime result.
- Recent message sync can request a smaller result set; stale or empty local projections should run
  a deeper message sync.

## Edits

- Editing runtime-owned config in Tavern updates Tavern-owned settings that Runtime uses to
  regenerate/apply managed OpenClaw config.
- Tavern applies the generated config through Runtime and refreshes relevant projections.
- If the edit fails, Tavern reports the failure and leaves the previous projection intact unless the
  user explicitly retries or refreshes.
- Runtime-originated edits emit runtime events and trigger targeted refresh.
- Tavern-originated writes should not require event echoes to be considered successful.
- Runtime-owned config edit forms should mount from Tavern-owned settings snapshots. Live runtime
  config reads are diagnostic and should not be the source of truth for product settings.
- The old synced full OpenClaw config draft is transitional. Managed settings should move to focused
  Tavern-owned records that Runtime composes into OpenClaw config.
- Runtime-owned config saves call the runtime first, update or upsert the matching projection from
  the runtime response, and then invoke the relevant sync path.
- The app may optimistically update local React Query state for responsiveness, but the durable
  projection is updated by the server write response or follow-up sync.

## Events

- Runtime event streams use WebSockets.
- Events identify the affected primitive and stable runtime id.
- Events may include a complete payload or only an invalidation hint.
- Tavern may refresh the affected projection over HTTP after receiving an event.
- Event subscriptions should be scoped narrowly when possible.
- Events are invalidation and freshness signals. They should enqueue or debounce sync jobs instead
  of making product screens depend on websocket payload completeness.
- Event payloads may be partial. Tavern should not require an event echo after a successful
  Tavern-originated write.

## Jobs

- Syncs run as visible jobs.
- Agent sync, cron sync, session sync, message sync, and log sync should be inspectable from the
  jobs surface.
- Automatic sync should not require users to manually run a job after connecting a runtime.
- Jobs are orchestration wrappers around reusable sync paths. tRPC procedures and event handlers may
  call the same sync path directly when they already own the user action, or enqueue the job when the
  work should be asynchronous and visible.
- Jobs should log the managed OpenClaw namespace and the number of projected records changed.

## Failure Behavior

- Runtime connectivity problems should not blank the app when projections already exist.
- OpenClaw sync errors should be visible and attributable to the managed OpenClaw capability/sync
  path.
- Failed sync should not delete previously observed history.
- Failed sync should not mutate Tavern-owned overlays.
