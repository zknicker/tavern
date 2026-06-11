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

* **Tavern: Wiki upkeep** — daily incremental compile of new raw sources, plus
  working off up to two proposed inventory follow-ups (research, dedup,
  candidate profiling). Records that need human judgment stay proposed.
* **Tavern: Wiki lint** — weekly structural lint with auto-fix, including
  backlink repair.
* **Tavern: Wiki librarian** — weekly staleness and quality pass. The scan is
  two-tier (cheap metadata pass, deep reads only for flagged or hot-volatility
  articles), so cost tracks problem density, not wiki size. After scoring, the
  same run repairs mechanical findings via `lint --fix`, recompiles articles
  with newer uncompiled sources, and files judgment items (unverified claims,
  thin coverage, dedup candidates) as proposed inventory records — findings
  become agent work, not reports to review. The daily upkeep automation
  consumes that queue.

Wiki automations are created once the wiki hub has at least one active topic,
so an empty hub does not burn scheduled agent turns.

## Boundary

Tavern Runtime owns automation records, schedule editing, delivery targets, run
history, chat delivery state, and the managed automation set. Hermes owns the
native agent execution that an automation triggers.
