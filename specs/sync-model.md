# Runtime Mapping

Tavern Runtime owns the canonical chat server model. OpenClaw is one agent runtime. The
OpenClaw adapter maps Gateway RPC, websocket events, and plugin callbacks into Tavern messages,
responses, artifacts, activity, and runtime evidence.

## Model

- Tavern Runtime owns chats, messages, events, reads, automations, deliveries, memory, generated
  OpenClaw config inputs, and jobs.
- Tavern App owns client cache, presentation state, profiles, participant links, and app settings.
- OpenClaw owns native agent execution, sessions, turns, transcripts, logs, agent files, tool
  settings, applied model/runtime config, and channel bindings.
- Tavern Runtime applies generated OpenClaw config inputs to OpenClaw.
- Runtime-visible skills remain owned by the runtime; OpenClaw remains authoritative for observed
  skill eligibility/status.
- OpenClaw-native tools may change native OpenClaw state.
- Tavern refreshes local records from OpenClaw on boot, reconnect, scheduled sync, manual refresh,
  and Gateway events.
- Each primitive has one reusable sync path. Scheduled jobs, websocket events, manual refreshes,
  and post-edit refreshes all invoke that same path.
- Each sync path records primitive-level freshness in `sync_state` when per-row freshness would not
  add useful information.

## Primitive Sync Ownership

| Primitive | Runtime authority | Tavern record | Freshness | Delete by absence |
| --- | --- | --- | --- | --- |
| `agent` | native runtime agent config | `agents` plus Tavern-owned presentation overlays | row `last_synced_at` and runtime sync state | yes, list is authoritative |
| `chat` | Tavern Runtime chats plus runtime-observed external platform conversations | `chats` cache records | row `last_synced_at` and runtime sync state | yes for runtime-owned external chats; no for Tavern-owned chats |
| `participant` | runtime-observed platform identity | `participants` and `participant_labels` | participant `last_seen_at` | no, manual profile links are Tavern-owned |
| `session` | runtime session index/history | `session_runs` | row `last_synced_at` inside payload and runtime sync state | no, keep observed history |
| `message` | Tavern Runtime chat history plus OpenClaw transcript evidence | `chat_messages` / `runtime_transcript_messages` tables | row `synced_at` and event cursor | only inside an authoritative fetched time window for evidence |
| `turn` | runtime live execution and events | event/log records | runtime sync state or event timestamp | no, keep observed history |
| `cron` | Tavern Runtime automation config | `automations` table | row `last_synced_at` and runtime sync state | yes, list is authoritative |
| `cron run` | Tavern Runtime automation history | `automation_runs` table | row `synced_at` and runtime sync state | no, keep observed history |
| `config` | Tavern-generated managed config | Tavern-owned settings plus diagnostic snapshots | settings `updated_at` and optional snapshot hash | Runtime reapplies generated config |
| `agent file` | runtime filesystem/config surface | fetched live on open, optional cached metadata later | explicit refresh timestamp | runtime-specific |
| `skill` | runtime skill inventory | fetched live on open, optional cached metadata later | explicit refresh timestamp | runtime-specific |

`last_synced_at` belongs on rows when rows can be updated independently. Primitive-level sync state
belongs in `sync_state` when a full list is refreshed together or when per-row freshness would always
be identical.

## Runtime Records

- Runtime evidence rows include the stable managed OpenClaw namespace `tavern-openclaw-managed`.
- Runtime evidence rows include the stable runtime id for the primitive.
- Runtime-backed rows include `last_synced_at`.
- Runtime chat sync maps typed chat participants into observed participants and labels for
  runtime-observed external chats.
- OpenClaw Tavern sessions do not create Tavern chat rows. They sync sessions, transcripts, and
  tool calls that attach to Runtime-owned Tavern chats by session key.
- Runtime adapters normalize platform-specific chat and participant facts before data reaches
  Tavern records.
- Tavern stores enough runtime evidence to keep the app useful when a runtime is offline.
- Runtime connectivity is Tavern Runtime health/capability state, not a selectable connection model.
- Product screens compose Tavern records from focused APIs. A missing or offline runtime shows stale
  records with freshness/error affordances instead of replacing pages with runtime connection
  blockers.

## Managed Config

- Tavern Runtime generates managed OpenClaw config from Tavern-owned state.
- If Runtime recreates OpenClaw state, it reapplies the generated config before normal sync.
- If a runtime removes an agent or cron job from an authoritative snapshot, Tavern may remove or
  hide the matching current record, but observed history remains archived.
- Tavern preserves Tavern-owned overlays such as agent color and avatar presentation separately from
  runtime-native records.
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
- Recent message sync can request a smaller result set; stale or empty local records run a
  deeper message sync.

## Edits

- Editing runtime-owned config in Tavern updates Tavern-owned settings that Runtime uses to
  regenerate/apply managed OpenClaw config.
- Tavern applies the generated config through Runtime and refreshes relevant records.
- If the edit fails, Tavern reports the failure and leaves the previous record intact unless the
  user explicitly retries or refreshes.
- Runtime-originated edits emit runtime events and trigger targeted refresh.
- Tavern-originated writes do not require event echoes to be considered successful.
- Runtime-owned config edit forms mount from Tavern-owned settings snapshots. Live runtime config
  reads are diagnostic and not the source of truth for product settings.
- Managed settings live as focused Tavern-owned records that Runtime composes into OpenClaw config.
- Runtime-owned config saves call the runtime first, update or upsert the matching Tavern record from
  the runtime response, and then invoke the relevant sync path.
- The app may optimistically update local React Query state for responsiveness, but the durable
  record is updated by the server write response or follow-up sync.

## Events

- Runtime event streams use WebSockets.
- Events identify the affected primitive and stable runtime id.
- Events may include a complete payload or only an invalidation hint.
- Tavern may refresh the affected record over HTTP after receiving an event.
- Event subscriptions are scoped narrowly when possible.
- Events are invalidation and freshness signals. They enqueue or debounce sync jobs instead of
  making product screens depend on websocket payload completeness.
- Event payloads may be partial. Tavern does not require an event echo after a successful
  Tavern-originated write.
- Runtime websocket events must not be the only copy of durable chat state. Accepted messages,
  running responses, and response activity that affect reload behavior need recoverable Runtime
  state. A hard reload after send acceptance recovers the accepted user message, active response,
  and already observed activity before the final assistant message exists.
- A durable message event is written in the same Runtime transaction as the accepted message it
  represents. Clients may use optimistic rows for speed, but reconciliation must be possible from a
  cursor-replayed event or an HTTP refetch.

## Jobs

- Syncs run as visible jobs.
- Agent sync, cron sync, session sync, message sync, and log sync are inspectable from the jobs
  surface.
- Automatic sync does not require users to manually run a job after connecting a runtime.
- Jobs are orchestration wrappers around reusable sync paths. tRPC procedures and event handlers may
  call the same sync path directly when they already own the user action, or enqueue the job when the
  work is asynchronous and visible.
- Jobs log the managed OpenClaw namespace and the number of records changed.

## Failure Behavior

- Runtime connectivity problems do not blank the app when records already exist.
- OpenClaw sync errors are visible and attributable to the managed OpenClaw capability/sync path.
- Failed sync does not delete previously observed history.
- Failed sync does not mutate Tavern-owned overlays.
