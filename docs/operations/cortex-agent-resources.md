---
summary: Cortex agent operating resources for search, recall, capture, and contradiction handling.
read_when:
  - changing Cortex agent instructions, recall behavior, capture rules, or maintenance workflows
  - changing generated AGENTS.md Cortex guidance
---

# Cortex Agent Resources

Cortex operating resources define how agents use durable Tavern knowledge.

## Resolver

Use the lightest Cortex tool that can answer the task:

* `cortex_get_page` for exact page or slug lookup.
* `cortex_search` for exact names, slugs, keywords, and quick existence checks.
* `cortex_recall` conservative for narrow facts.
* `cortex_recall` balanced when prior durable context may affect the answer.
* `cortex_recall` tokenmax for broad synthesis, contradictions, planning,
  audits, recurring decisions, project history, and "what do we know" work.
* `cortex_list_backlinks` when graph context or relationship traversal matters.
* `cortex_capture` only for explicit durable saves or corrections.

## Brain Ops

Check Cortex before external lookup when Cortex may already contain the answer.
When Cortex context changes the answer, cite the page or source basis. Current
user instructions beat Cortex compiled truth; compiled truth beats timeline
evidence; timeline evidence beats external sources.

## Signal Detector

Capture durable preferences, decisions, corrections, source-backed project facts,
business rules, recurring workflows, and reusable context. Do not capture secrets,
transient execution chatter, guesses, or broad chat dumps.

## Conventions

Compiled truth is the current best synthesis. Timeline entries are append-only
evidence. Links should be typed with the active Cortex schema. Contradictions
must preserve both sides as evidence, update current truth, and mark older claims
contradicted or superseded instead of deleting history.
