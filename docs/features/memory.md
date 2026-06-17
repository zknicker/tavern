---
summary: Memory feature for assistant memory, Vault knowledge, and the context-management boundary.
read_when:
  - changing assistant memory, memory visibility, Vault status, or Vault-backed knowledge expectations
  - changing the boundary between Hermes context management and durable wiki knowledge
---

# Memory

Tavern has two memory surfaces:

* **Assistant memory.** Runtime configures the managed agent with the local
  Mnemosyne memory provider. It is prompt-time memory tooling, exposed to the
  agent as `memory_*` tools and surfaced operationally through Runtime
  capabilities. The provider is not a skill package and does not appear in the
  skills list.
* **Vault knowledge.** Vault is the browsable wiki. Durable knowledge that
  users inspect lives in Markdown files. Agents use the managed Vault skill to
  route normal wiki work to Obsidian and bounded research folders to llm-wiki.

## In Vault

Users can inspect:

* the resolved Vault path
* Markdown page counts
* filesystem read/write health
* pages, links, backlinks, and search results

## Contract

User-facing knowledge visibility is file-backed. The Memory and Vault surfaces
read wiki Markdown. They do not expose model settings, hidden queues, generated
schemas, or internal repair controls.

Assistant memory is an execution capability. It can affect what the agent
recalls during work, but it is not the Vault wiki and is not edited through the
wiki browser.

## Boundary

Vault is the browsable wiki. Agents maintain it through the managed `vault`
skill.

See [Vault](../../specs/vault.md) and
[Context management](context-management.md).
