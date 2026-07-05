# Self-Learning Agents

This plan makes Tavern agents learn and act on their own schedule: a
Runtime-native cron scheduler behind the existing Cron product surface, agent
skill authoring, a signal-gated skill review worker, a curator, and one
observability surface for all background work.

Contracts: [specs/cron.md](../specs/cron.md),
[specs/skill-learning.md](../specs/skill-learning.md),
[specs/memory-lifecycle.md](../specs/memory-lifecycle.md).

## Goal

An agent that gets better with use: it schedules its own follow-ups, encodes
corrections and techniques into skills, and Runtime consolidates that library
over time — all inspectable from the app.

## Locked Decisions

- Learned skills live in the shared global library, auto-enabled for the
  authoring agent only.
- Skill review runs on the Standard model category; the curator runs on Deep.
- The curator auto-runs (weekly, idle-gated), archive-only, and writes a
  structured report per run. No approval queue.
- Skill review is signal-gated: extraction emits learning signals; review runs
  only when signals exist. Extraction and review stay separate executions.
- Cron jobs name an explicit delivery target (a Chat the owning Agent
  participates in, or its DM channel). No originating-chat default.
- Agent cron tools are restricted to that same delivery rule; agent-created
  jobs are ordinary, fully visible cron jobs.
- Background-work observability lives on the memories settings page. Cron
  keeps its own page and run history.

## Out Of Scope

- Automation suggestion registry (usage-detected suggested crons).
- Agent write path for `SOUL.md`.
- Cron blueprint/template catalog.
- System maintenance as managed crons (rejected previously; workers only).

## Slice 1: Runtime Cron Scheduler

Problem: the Cron product surface (server API, app pages, delivery path) is
live but dead — the Runtime proxy stubs `{ jobs: [] }` because the removed
engine owned scheduling.

Work:

- Cron storage in Runtime SQLite: `cron_jobs` and `cron_runs` (additive
  schema, `ensureColumn` pattern).
- Scheduler tick in the Runtime jobs manager; due jobs run an Agent turn via
  `enqueueAgentTurn` and deliver through the existing
  `deliverAgentCronToTavernChat` path.
- Replace the proxy cron stubs with real CRUD against a Runtime cron service:
  create, update, pause, resume, trigger, delete, list, run history.
- Delivery target validation at create/update and run time per spec.
- Restore a `cron` Runtime capability; gate app cron surfaces on it.
- App: wire the existing cron pages to live data; the delivery picker offers
  the owning agent's Chats and DM channel.

Fix locations: `apps/runtime/src/cron/` (new), `apps/runtime/src/tavern/proxy.ts`,
`apps/runtime/src/db/schema.ts`, `apps/runtime/src/jobs/`,
`apps/server/src/api/cron/`, `apps/website/src/features/cron/`.

Verification: Runtime tests on temp SQLite (schedule evaluation, missed-window
behavior, target validation, run records); app e2e with the mock runtime for
create → run → delivered chat message.

## Slice 2: Agent Cron Tools

Depends on slice 1.

Work:

- `cron_create`, `cron_list`, `cron_update`, `cron_delete` Tavern tools
  following the Memory tools pattern.
- Guardrails: tools may only target Chats the agent participates in or its DM
  channel; jobs carry the owning agent id.
- Tool guidance in managed instructions; docs for the tools in `docs/api/`.

Verification: Runtime tool tests; one e2e where an agent turn creates a job
that later delivers.

## Slice 3: Skill Tools And Usage Telemetry

Work:

- Write path in the skill library: create, patch, write-file with hash
  validation and read-only protection for seeded and hub-installed skills.
- Agent tools: `skills_list`, `skill_view`, `skill_create`, `skill_patch`,
  `skill_write_file` (new `apps/runtime/src/skills/agent-tools.ts`, Memory
  tools pattern).
- Auto-enable authored skills for the authoring agent
  (`agent_skill_assignments`).
- Usage telemetry: record per-session skill injections and explicit views in
  Runtime SQLite.
- Optional cleanup while in there: the skills dir constant lives under the
  misleading `AGENT_HOME` name; rename toward `RUNTIME_ROOT`-relative naming.

Fix locations: `apps/runtime/src/agent-engine/skill-library.ts` (split as it
grows), `apps/runtime/src/skills/` (new), `apps/runtime/src/tavern/harness-agent-executor.ts`,
`apps/runtime/src/db/schema.ts`.

Verification: Runtime tests for write protection, hash collisions,
auto-enable, and telemetry rows.

## Slice 4: Learning Signals And Skill Review Worker

Depends on slice 3.

Work:

- Extraction output gains learning signals (style/workflow corrections,
  frustration, technique, in-play skill misfire); persist alongside episodic
  observations.
- The shared worker-run record is the existing `memory_jobs` table with its
  kind set widened to `skill_review` and `curation` (guarded schema-repair
  rebuild) — extraction and dream runs already live there, and slice 6 reads
  it as the observability backbone.
- Skill review worker: queued per agent when signals exist; Standard category;
  toolset = skill tools + read-only chat context; prompt implements the update
  ladder and never-capture rules from the spec; records actions in its
  `worker_runs` report.

Fix locations: `apps/runtime/src/memory/extraction.ts`,
`apps/runtime/src/memory/worker.ts`, `apps/runtime/src/skills/` (review
worker), `apps/runtime/src/db/schema.ts`.

Verification: Runtime tests with mocked model calls: signal → queued review;
no signal → no run; review writes only through skill tools; protected skills
untouched.

## Slice 5: Curator

Depends on slices 3 and 4.

Work:

- Curator worker: weekly + idle gate, Deep category; umbrella consolidation,
  package-integrity moves, archive dir under the library, structured
  consolidations/prunings report into `worker_runs`.
- Automatic staleness transitions (active → stale → archived) driven by usage
  telemetry; reactivation on use.

Verification: Runtime tests on temp dirs: consolidation moves whole packages,
archive-only invariant, protected and pinned-equivalent (read-only) skills
skipped, transitions from synthetic usage data.

## Slice 6: Background Work Observability

Depends on slice 4 for `worker_runs`; UI shell can start earlier.

Work:

- Server API: worker-run list and report reads (extend `api/memory/jobs.ts`
  or a focused `api/worker` addition), plus next-run/trigger-condition hints
  per worker kind.
- Memories settings page: background work table (kind, enabled, last run,
  duration, next run), runs-over-time timeline chart, per-run report drawer.
- Model settings: render all four model categories (`fast`, `standard`,
  `deep`, `visual`) in `background-models-section.tsx` — `deep` becomes
  load-bearing for the curator.
- Keep volatile run data in focused queries, not on shared records.

Fix locations: `apps/server/src/api/memory/`,
`apps/website/src/features/settings/memories/`,
`apps/website/src/features/settings/models/background-models-section.tsx`.

Verification: app e2e against the mock runtime seeding worker runs; unit tests
for next-run formatting and report rendering.

## Docs

Each slice updates its docs in the same pass: `docs/features/automations.md`
and `docs/api/` for cron and tools, `docs/features/` for skill learning and
the background work surface, `.env.example` if configuration is added.
