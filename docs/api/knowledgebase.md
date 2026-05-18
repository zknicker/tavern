---
read_when:
  - changing knowledgebase pages, files, citations, links, or collections
  - changing how agents create durable working material
---

# Knowledgebase API

The Knowledgebase API is for wiki-style working material.

Knowledgebase records are larger and more structured than memory. They can hold
pages, files, citations, backlinks, collections, and agent-authored notes.

## Contract

* Pages and files have stable ids.
* Source material keeps citation and attachment metadata.
* Agent-authored notes are attributable to the agent, chat, message, or run that
  produced them.
* Pages can link to chats, messages, automations, files, and other pages.
* Search results return enough metadata for clients to cite the source.
* Knowledgebase content is readable by agents through explicit Tavern capability
  surfaces.

## Surface

The API covers:

* list and search pages
* get a page
* create or update a page
* delete or archive a page
* attach files and citations
* link related pages
* list backlinks
* inspect attribution and timestamps

## Memory Boundary

Memory stores small facts and preferences agents keep in mind.
Knowledgebase stores durable working material. Do not turn every note into
memory, and do not hide long-lived project material in prompt-only context.

## Related Docs

* [Knowledgebase feature](../features/knowledgebase.md)
* [API overview](overview.md)
* [Data model](../internals/data-model.md)
