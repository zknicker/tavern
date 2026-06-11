---
summary: Scheduled work feature for cron automations, run history, delivery targets, follow-up state, and Runtime/Hermes ownership.
read_when:
  - changing scheduled work, recurring runs, or automation history
  - changing cron delivery or run history presentation
---

# Automations

Automations let users ask agents to do work later or on a schedule.

## In the box

* **Cron automations.** Recurring agent work runs on a schedule, even while the
  app is closed.
* **Managed automations.** Tavern ships default automations it owns, starting
  with the Cortex wiki maintenance set.
* **Run history.** Past runs stay visible, including status and delivery.
* **Delivery targets.** Automation output can land in the right chat.
* **Follow-up state.** Users can see what ran, what failed, and what comes next.

## Managed automations

Tavern defines some automations in code and keeps them in sync itself. Managed
automations use the reserved `Tavern: ` name prefix and carry `managed: true`
in automation reads. Users can pause, resume, and run them now; they cannot
edit their name, schedule, prompt, or delivery, and they cannot delete them.
User automations cannot take a reserved name.

Runtime reconciles the managed set on startup and hourly: missing defaults are
created, drifted schedules or prompts are repaired, and retired managed
automations are removed. Pause state is preserved across reconciliation.

The current managed set keeps the Cortex wiki healthy, following the llm-wiki
maintenance cadence:

* **Tavern: Wiki upkeep** — daily incremental compile of new raw sources,
  finishing with a structural pass over the wikis it changed. A Runtime job
  also checks every 15 minutes for uncompiled raw sources — counted from each
  topic's `log.md` order, no agent run — and triggers upkeep when a topic
  reaches 5 pending sources (llm-wiki's compile-nudge threshold); smaller
  ingests wait for the daily run, which already bounds their delay. A settle
  window lets batch ingests finish first, and a one-hour cooldown keeps
  triggers from stacking. Pausing the upkeep automation also pauses the
  pending-source trigger.
* **Tavern: Wiki lint** — weekly structural lint with auto-fix, including
  backlink repair.
* **Tavern: Wiki librarian** — weekly staleness and quality pass. The scan is
  two-tier (cheap metadata pass, deep reads only for flagged or hot-volatility
  articles), so cost tracks problem density, not wiki size. After scoring, the
  same run repairs mechanical findings via `lint --fix`, recompiles articles
  with newer uncompiled sources, and files judgment items (unverified claims,
  thin coverage, dedup candidates) as todos — findings become agent work, not
  reports to review.

Todos (llm-wiki inventory records) are not drained by a cron. A Runtime job
checks the queue every 15 minutes and runs one focused agent turn per open
todo, spaced by a cooldown, so a deep queue drains steadily and an empty queue
costs nothing. A todo that keeps failing is escalated or marked blocked rather
than retried forever. The queue, processing state, and recent completions show
on the Cortex health page.

Escalation is a last resort. When no autonomous workflow can resolve a todo
(claim verification, retraction calls, paid or private access), the agent marks
it with llm-wiki's `owner: user` convention and a one-line question. Escalated
todos surface on the Cortex health page and as a homepage highlight; answering
one spawns an agent chat that applies the decision to the wiki. Nothing pings
chat uninvited, and everything else drains automatically.

Wiki automations are created once the wiki hub has at least one active topic,
so an empty hub does not burn scheduled agent turns.

## Boundary

Tavern Runtime owns automation records, schedule editing, delivery targets, run
history, chat delivery state, and the managed automation set. Hermes owns the
native agent execution that an automation triggers.
