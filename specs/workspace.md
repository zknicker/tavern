# Workspace

Tavern owns the managed Hermes workspace it creates for Tavern agents.

The workspace is the prompt-facing home that Hermes loads for each agent
session. Tavern exposes the Hermes-supported markdown files directly:

* `AGENTS.md` lives in the managed Hermes workspace and carries workspace
  instructions, conventions, and operating context.
* `SOUL.md` lives in the managed Hermes home and carries identity, voice, tone,
  and durable personality. Hermes does not load `SOUL.md` from the working
  directory.

Both files are live agent state. Hermes injects them at prompt build, so edits
take effect on the next turn.

## Managed Block

`AGENTS.md` contains exactly one Tavern-managed block, delimited by markers:

```
<!-- tavern:managed v=<content-hash> -->
...Tavern-managed instructions...
<!-- /tavern:managed -->
```

The managed block is Tavern's only write surface in the file. It carries:

* **Environment.** The agent's identity as the Tavern agent, the chat /
  session / automation product nouns, and what the agent's Tavern access can
  and cannot touch.
* **Memory.** Cortex/llm-wiki routing, conflict priority, and provenance
  rules, plus the memory model boundary: Cortex is durable knowledge; per-turn
  context management is separate.
* **Self-maintenance.** The agent may edit `AGENTS.md` outside the managed
  block, and `SOUL.md`, directly with its file tools.
* **Tavern access pointer.** Operations on Tavern and product questions route
  through the `tavern` skill ([tavern-skill.md](tavern-skill.md)).

The managed block is written in product language and does not name Hermes.

## Recompose Rules

Runtime reconciles the managed block during runtime sync, when `AGENTS.md` is
saved through the agent file API, and before each turn dispatch — so a
tampered block heals before it can ride along in another prompt:

* The block is versioned by a hash of its content. A matching hash is a no-op.
* A differing hash rewrites only the managed block. All content outside the
  markers is preserved byte-for-byte.
* A missing `AGENTS.md` is seeded with the managed block and a short hint that
  the rest of the file belongs to the user and the agent.
* Missing markers (for example, deleted by hand) cause the block to be
  re-inserted at the top of the file without touching the rest.
* Runtime never writes `SOUL.md`.

Everything outside the managed block is user- and agent-owned free text.
Tavern never regenerates, reorders, or normalizes it.

## Editing

* Users edit `AGENTS.md` and `SOUL.md` in agent settings through Runtime's
  agent file API.
* Agents edit the same files directly with file tools. There are no separate
  Tavern note-taking tools and no DB-backed instruction sources.
* The app may later render the managed block read-only or collapsed in the
  settings editor; correctness does not depend on it.

## Legacy

Runtime clears unsupported legacy companion bootstrap files such as `TOOLS.md`,
`IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`, and
`ROLE.md` from the managed workspace. It does not clear `SOUL.md`. The app does
not expose those legacy files.
