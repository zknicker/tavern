# Skill Learning

Tavern agents learn. They author and improve skills from experience, and
Runtime keeps the skill library healthy over time.

Skill inventory, enablement, and settings UI are specified in
[Skills and Tools](skills.md). Memory layers and worker observability are
specified in [Memory Lifecycle](memory-lifecycle.md).

## Skill Library

- Runtime owns one global skill library on disk. There are no per-agent skill
  stores; per-agent access is enablement state, not file copies.
- A skill is a package: `SKILL.md` plus optional `references/`, `templates/`,
  `scripts/`, and `assets/` files.
- Every skill on disk is writable by agents and workers, whatever its source
  (seeded, hub-installed, agent-created, or operator-placed). Plugin-provided
  skills are not files — they are served live from the plugin and cannot be
  edited.
- Nothing rewrites skill files in the background. Content from Tavern arrives
  only at explicit moments:
  - Hub install records the installed content hash. Reinstalling an unedited
    skill replaces it cleanly; reinstalling an edited skill is a conflict the
    user resolves explicitly (keep local or take the hub version) — never a
    silent overwrite. The Skills page shows when a newer hub version exists.
  - The seeded skill is created once and never refreshed. Its page offers a
    reset to the current release's default.
- When an agent or worker creates a skill, it is auto-enabled for the authoring
  agent only. Other agents gain it through normal skill enablement.

## Agent Skill Tools

- Agents get skill tools: `skills_list`, `skill_view`, `skill_create`,
  `skill_patch`, and `skill_write_file`.
- Writes are hash-validated against the last read, matching the Memory write
  collision contract.
- Writes to plugin-provided skills fail with a clear error; there is no file
  to edit.
- Skill changes take effect at the next session. Sessions do not hot-swap
  skills mid-turn.

## Learning Signals

- Extraction workers emit learning signals alongside their observations: user
  style or workflow corrections, frustration markers, non-trivial techniques
  worth keeping, and misfires of a skill that was in play.
- Learning signals queue a skill review run for the owning agent. Windows with
  no signals never trigger review.

## Skill Review Worker

- Skill review runs after settled windows that produced learning signals, with
  the Standard model category, and a toolset limited to skill tools plus
  read-only chat context.
- Update ladder, earliest fit wins:
  1. patch the skill that was in play this window
  2. patch an existing class-level skill
  3. add a `references/`, `templates/`, or `scripts/` file under an existing
     skill
  4. create a new class-level skill
- New skill names are class-level. Session artifacts (a PR number, an error
  string, a one-off task) are not skill names.
- Never captured: environment-dependent failures, negative claims about tools
  or features, transient errors that already resolved, and one-off task
  narratives. Setup failures are captured as their fix under a setup or
  troubleshooting skill, never as a standing constraint.
- User preference corrections are embedded in the governing skill body, not
  only in Memory.
- Every run records the actions taken: skills created or patched, files added,
  and the reason for each.

## Curator

- The curator is a periodic consolidation worker: weekly cadence, runs only
  when the Runtime is idle, with the Deep model category.
- It consolidates narrow skills into class-level skills: merge into an
  existing skill, create a new umbrella skill, or demote a sibling to a
  support file.
- Consolidation moves whole packages. A skill's support files move with it or
  the skill stays standalone; instructions never point at files left behind.
- Archive is the maximum destructive action. Archived skills move to the
  library archive and are recoverable. The curator never deletes.
- The curator consolidates and archives agent-created skills only; seeded,
  hub-installed, and operator-placed skills are never archived or absorbed.
- Runtime tracks per-skill usage: injections into sessions and explicit views.
  Unused skills transition active to stale to archived on inactivity
  thresholds; use reactivates a stale skill.
- Every run writes a structured report: consolidations (from, into, reason)
  and prunings (name, reason).
- The curator runs automatically. There is no approval step; runs are audited
  from report history in the app.

## Observability

Skill review and curator runs appear in the background work surface on the
memories settings page with run history, per-run reports, and next-run hints.
See [Memory Lifecycle](memory-lifecycle.md).
