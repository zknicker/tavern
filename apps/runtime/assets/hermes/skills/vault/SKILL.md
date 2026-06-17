---
name: vault
description: >
  Use for Vault, wiki, durable knowledge, project notes, research notes,
  operating docs, Obsidian notes, backlinks, knowledge hub, directory, index,
  and long-term agent-readable context.
---

# Vault

Managed by Tavern Runtime. Do not edit this skill directory; Runtime refreshes
it on startup. For durable agent-managed skill changes, create or update a
separate skill in your normal skills directory.

Vault is the user's central knowledge hub: durable Markdown, inspectable by the user, maintained by agents.

## Path

Use `TAVERN_VAULT_PATH`. If unset, use `~/wiki`. Do not guess sibling vaults.

## Routing

Use the Obsidian skill for normal Vault work: create/edit notes, backlinks, project docs, cleanup, and indexes.

Use the llm-wiki skill for bounded research folders when the user asks for research, source collection, synthesis, or a compiled research workspace.

Use memory tools only for prompt-time personal recall. Memory is not Vault.

## Index

`INDEX.md` at the Vault root is the global directory.

Before changing Vault structure, read `INDEX.md`.

When adding, moving, renaming, or substantially changing durable notes, update `INDEX.md` if navigation changes.

## Conventions

Before creating a new note, search for related existing notes.

Use Obsidian wikilinks for related durable concepts.

After creating or updating a note, add useful backlinks or a short related section.

Keep project pages current when project facts, status, links, or operating notes change.
