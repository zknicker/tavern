---
summary: Memory feature for assistant memory, Vault knowledge, and the context-management boundary.
read_when:
  - changing assistant memory, memory visibility, Vault status, or Vault-backed knowledge expectations
  - changing the boundary between Hermes context management and durable wiki knowledge
---

# Memory

Tavern has two memory surfaces:

* **Assistant memory.** Runtime enables the engine's built-in prompt-time
  memory files: `MEMORY.md` for compact assistant operating notes and
  `USER.md` for stable user profile facts. Agents write them through the
  native `memory` tool. The files are not Vault pages and are not skill
  packages.
* **Vault knowledge.** Vault is the browsable wiki. Durable knowledge that
  users inspect lives in Markdown files. Agents use the managed Vault skill to
  route normal wiki work to Obsidian and bounded research folders to llm-wiki.

## In Vault

The Memory page summarizes Vault readiness and maintenance paths. Vault remains
the file browser for the underlying Markdown knowledge.

Users can inspect:

* the resolved Vault path
* Markdown page counts
* filesystem read/write health
* pages, links, backlinks, and search results

## Contract

User-facing knowledge visibility is file-backed. The Memory and Vault surfaces
read wiki Markdown. They do not expose model settings, hidden queues, generated
schemas, or internal repair controls.

Assistant memory is engine execution state. It can affect what the agent
recalls during work, but it is not the Vault wiki and is not edited through the
wiki browser. Durable, inspectable knowledge belongs in Vault.

## Boundary

Vault is the browsable wiki. Agents maintain it through the managed `vault`
skill.

See [Vault](../../specs/vault.md) and
[Context management](context-management.md).
