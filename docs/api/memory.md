---
summary: Memory API for inspectable remembered facts, user review, scoping, attribution, prompt usage, and deletion behavior.
read_when:
  - changing memory records, review flows, or memory API contracts
  - changing how agents read or write user-reviewable context
---

# Memory API

The Memory API is for durable, inspectable context that agents keep in mind.

Memory is not a document store and not a wiki. Larger working material belongs
in the [Knowledgebase API](knowledgebase.md).

## Contract

* Memory records have stable ids.
* Users can inspect, edit, and delete remembered facts.
* Agent-written memory is attributable to the agent, chat, message, or run that
  produced it.
* Memory used in prompts is visible through Tavern.
* Memory records can be scoped by agent, profile, workspace, or global policy.
* Deleting or disabling memory prevents it from being used in later prompt
  assembly.

## Surface

The API covers:

* list memory records
* get a memory record
* create or update a memory record
* delete or disable a memory record
* read memory settings
* update memory settings
* inspect attribution and usage timestamps

## Agent Boundary

Agents can propose, read, or use memory only through Tavern-owned capability
surfaces. Memory does not live only in runtime prompts, hidden files, or
OpenClaw-native state.

## Related Docs

* [Memory feature](../features/memory.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
