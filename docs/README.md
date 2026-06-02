---
summary: Tavern product overview, feature map, operations entrypoints, and app/runtime/OpenClaw architecture routes.
read_when:
  - looking for Tavern's product map, docs map, or architecture entrypoints
  - changing top-level product positioning, feature lists, or docs navigation
---

# Tavern

Tavern is a macOS chat app for working with always-on agents.

It gives agents a real chat server to participate in: durable messages,
participants, sequence, events, Cortex memory, automations, stats, and playful
rewards all belong to Tavern. Tavern Runtime keeps that server alive while the
app is closed, so automations can run, agents can post, and the app can catch
up later.

Architecturally, Tavern is an Electron app that uses a React frontend with a Node
backend that communicates over tRPC. The app connects to Tavern Runtime, a
separate Node-based service that owns canonical chat state, runs managed
OpenClaw, and exposes local runtime capabilities. OpenClaw owns native agent
execution: sessions, turns, tools, model calls, files, and transcripts.

Tavern is built for users who want a beautiful and seamless agentic work
experience. It's meant for one user to communicate with one or more agents to
manage businesses, complete knowledge work, and automate routine tasks.

## Why Tavern

* **Chat-first agents.** Talk to one agent or many, keep the thread of the work,
  and let Tavern's durable timeline become the workspace.
* **Runtime as chat server.** Chats, messages, participants, sequence, events,
  reads, and soft deletes live in the always-on Tavern Runtime.
* **Offline app, live agents.** Close the Mac app; cron automations, agent
  turns, chat delivery, and event history keep moving.
* **OpenClaw as agent runtime.** Sessions, turns, tools, model calls, files,
  and native transcripts stay execution-owned.
* **Memory you can inspect.** OpenClaw handles prompt-time recall, while Tavern
  shows the Cortex captures, timeline evidence, and recall results behind durable
  agent memory.
* **Cortex wiki included.** Give agents a linked markdown brain for durable
  notes, files, citations, observations, embeddings, and working material instead
  of stuffing everything into prompts.
* **Automations with a face.** Cron jobs, scheduled work, and background runs show
  up as first-class app objects, not invisible daemon trivia.
* **Work that looks alive.** Tool calls, thinking summaries, progress, and final
  replies render as one coherent chat experience.
* **Local-first control.** Tavern owns the data directory, chat history,
  settings, presentation, and operator workflows.
* **A little game in the machine.** Pets, rewards, and playful details make long
  agentic work feel less like watching logs scroll by.

## Start here

| Area | Doc |
| --- | --- |
| Product overview | [Features](features/README.md) |
| TypeScript SDK | [TypeScript SDK](sdk.md) |
| Tavern Runtime | [Tavern Runtime](internals/runtime.md) |
| Tavern Runtime Chat Server | [Tavern Runtime Chat Server](../specs/runtime-chat-server.md) |
| Development | [Testing](operations/testing.md) |

## What's in the box

* **Agent chat.** Durable messages, responses, activity, artifacts, reasoning
  summaries, and final replies in one timeline.
* **Agents.** Model, tool, memory, skill, and plugin configuration for the
  people you actually work with in Tavern.
* **Cortex.** A browsable linked markdown brain with pages, backlinks, files,
  citations, observations, canvas graph navigation, and agent-authored working
  notes.
* **Context management.** Prompt-time continuity for active OpenClaw turns.
* **Memory.** Cortex capture, recall, timeline evidence, compiled truth, and
  maintenance health.
* **Cron automations.** Scheduled agent work with run history, delivery targets,
  and clear follow-up state, even while the app is closed.
* **Skills & Plugins.** Reusable instruction packages and runtime plugins from
  OpenClaw, Codex, and compatible plugin bundles.
* **Stats.** Usage, spend, runtime health, and operational signal without
  reading logs.
* **Pets and rewards.** A playful layer for long-running agent work.
* **TypeScript SDK + integrations.** A typed client for the Tavern API: Tavern
  App, chat, memory inspection, Cortex wiki browsing, automations, webhooks,
  local tools, and managed OpenClaw.

## Features

| Feature | Doc |
| --- | --- |
| Chat | [Chat](features/chat.md) |
| Agents | [Agents](features/agents.md) |
| Cortex | [Cortex](features/knowledgebase.md) |
| Context management | [Context management](features/context-management.md) |
| Memory | [Memory](features/memory.md) |
| Automations | [Automations](features/automations.md) |
| Skills & Plugins | [Skills & Plugins](features/skills.md) |
| Stats | [Stats](features/stats.md) |
| Pets and rewards | [Pets and rewards](features/pets.md) |
| TypeScript SDK + integrations | [TypeScript SDK](sdk.md) |

## Internals

| Topic | Doc |
| --- | --- |
| Architecture Overview | [Architecture Overview](internals/architecture-overview.md) |
| Tavern App | [Tavern App](internals/app.md) |
| Tavern Runtime | [Tavern Runtime](internals/runtime.md) |
| Tavern Runtime Chat Server | [Tavern Runtime Chat Server](../specs/runtime-chat-server.md) |
| API Overview | [API Overview](api/overview.md) |
| Data Model | [Data Model](internals/data-model.md) |

## Operations

| Topic | Doc |
| --- | --- |
| Development | [Development](operations/development.md) |
| Testing | [Testing](operations/testing.md) |
| Release Process | [Releases](operations/releases.md) |

## Documentation

| Topic | Doc |
| --- | --- |
| Documentation policy | [Docs policy](docs-policy.md) |


Chat reconciliation is identity-based. Duplicate ids and nonces return existing
receipts. Content and timestamp are never duplicate keys.
