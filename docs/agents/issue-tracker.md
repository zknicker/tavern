---
summary: Agent-skill issue tracker configuration for Linear.
read_when:
  - using issue-writing, PRD, or triage skills in this repo
  - changing where Tavern agent-skill issues are tracked
---

# Issue tracker: Linear

Issues and PRDs for this repo live in Linear under the `TAVERN` team.

## Conventions

- Use Linear tooling for issue operations, not GitHub Issues or local markdown.
- Create Tavern repo work in the Linear `TAVERN` team unless the user names another team.
- If a skill needs to create an issue and the Linear project is ambiguous, ask for the target
  project before creating it.
- If a skill needs to fetch a ticket, use the Linear issue key or URL the user provides.
- Triage state uses the labels defined in `docs/agents/triage-labels.md`.

## Publishing work

When a skill says "publish to the issue tracker," create a Linear issue in the `TAVERN` team.

## Fetching work

When a skill says "fetch the relevant ticket," read the referenced Linear issue by key or URL.
