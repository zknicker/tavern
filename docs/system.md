# System

Tavern sits between people, OpenClaw, and supporting data systems. It owns the product model and
maps external systems into Tavern-owned domains.

```mermaid
flowchart TD
    clients[Humans / Dashboard / MCP / CLI / API]
    runtimes[OpenClaw]
    sources[Memory + External Sources]

    clients --> tavern
    runtimes --> tavern
    sources --> tavern

    subgraph tavern[Tavern]
        direction TB
        shell[Dashboard + tRPC + invalidation events]
        domains[Tavern domain services<br/>agents / chats / sessions / cron / workers / memories / models / jobs]
        sync[Sync jobs + projections + background refresh]
        adapters[Adapters + packages]
        storage[(SQLite + cached documents)]

        shell --> domains
        domains --> sync
        adapters --> domains
        sync --> storage
        storage --> domains
    end

    domains --> agents[Agents]
    domains --> sessions[Sessions]
    domains --> chats[Chats]
    domains --> cron[Cron]
    domains --> workers[Workers]
    domains --> memories[Memories]
    domains --> models[Models]
    domains --> jobs[Jobs]
```

## Reading The Diagram

- Tavern owns the domain model in the middle.
- OpenClaw and external systems plug in through adapters and packages, not by owning Tavern
  domains.
- The dashboard and API read Tavern-owned stored and projected state rather than depending on live
  runtime availability.
