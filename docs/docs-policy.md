---
summary: Documentation policy for product-first structure, surfaces, frontmatter routing, ClickClack-style writing, reviews, and maintenance.
read_when:
  - adding docs, reorganizing docs, or changing documentation style
  - turning implementation notes, specs, or architecture decisions into docs
---

# Docs Policy

Tavern docs read like a small product with a clear architecture, not a source
tree tour. The front door explains why Tavern exists. Feature docs explain what
users can do. SDK docs explain how other code talks to Tavern. Internals explain
how the product is built.

For API work, Tavern follows an OpenAPI-first shape: OpenAPI contract, generated
types, Runtime handlers, SDK wrapper, docs, then gates.

## Source Model

This policy follows the documentation shape used by ClickClack:

* [ClickClack docs README](https://github.com/hermes/clickclack/blob/main/docs/README.md)
* [Messages](https://github.com/hermes/clickclack/blob/main/docs/features/messages.md)
* [Realtime](https://github.com/hermes/clickclack/blob/main/docs/features/realtime.md)
* [TypeScript SDK](https://github.com/hermes/clickclack/blob/main/docs/sdk.md)
* [Data model](https://github.com/hermes/clickclack/blob/main/docs/data-model.md)
* [Architecture overview](https://github.com/hermes/clickclack/blob/main/docs/architecture/overview.md)
* [Releasing](https://github.com/hermes/clickclack/blob/main/docs/releasing.md)

## North Star

Good Tavern docs are:

* **Product-first.** Start with the thing a user, bot, or operator can do.
* **Message-tight.** Prefer short paragraphs, tables, and bullets with bold
  leads over long explanatory prose.
* **Contract-shaped.** State durable rules, identifiers, ordering, recovery,
  ownership, and out-of-scope behavior.
* **Browsable.** A reader knows where to go next without reading every page.
* **Honest about scope.** Product contracts, source of truth, and intentional
  omissions are explicit.

## Surfaces

Use the docs tree as a product map.

| Surface | Purpose | Examples |
| --- | --- | --- |
| `docs/README.md` | Product front door and routing table | why Tavern, what's in the box, start here |
| `docs/features/` | User-facing capabilities | chat, agents, memory, automations, skills |
| `docs/api/` | Tavern API capability contracts | chat API, realtime, auth |
| `docs/sdk.md` | TypeScript SDK client wrapper | SDK quick start, bot examples |
| `docs/internals/` | Architecture and ownership | app, runtime, frontend, data model |
| `docs/operations/` | Running and maintaining Tavern | testing, releases, upgrades, deploy |
| `specs/` | Locked design decisions and deeper specs | protocol details, long-form plans |

Keep root docs sparse. New docs fit one of these surfaces unless they are
temporary planning material that gets deleted quickly.

## Front Page

The docs README works like a product page plus a map.

Use this shape:

1. One compact product description.
2. `Why Tavern`: feature bullets with bold leads.
3. `Start here`: a small table for the most common reader intents.
4. `What's in the box`: product-facing feature list.
5. `Operate it`: developer and operator workflows.
6. `Look under the hood`: architecture, data model, and specs.
7. `Documentation`: docs policy and contribution rules.

Do not make the README a file inventory. It points to the right pages instead
of explaining every detail itself.

## Feature Docs

A feature is something Tavern exposes as a product capability. Good feature
names are `Chat`, `Agents`, `Memory`, `Vault`, `Cron automations`,
`Skills`, `Plugins`, `Stats`, `Pets and rewards`, and `TypeScript SDK`.

Implementation nouns are not features. Avoid feature pages named `Frontend`,
`Server`, `Sessions`, `Runtime records`, `Hermes plugin`, or `Runtime status`.
Those belong in internals, operations, or SDK pages.

Use this template:

```md
---
read_when:
  - changing the user-facing feature
  - changing the durable records or API contract behind it
---

# Feature Name

One short paragraph that says what the feature is.

## In the box

* **Capability.** What users or external clients can do.
* **Capability.** Another concrete product behavior.

## Contract

Stable ids, ownership, ordering, recovery, permissions, and invariants.

## API and data

The API surface, SDK surface, or durable records the feature depends on.

## What is intentionally missing

Non-goals and deferred features.
```

Every feature page answers: what is this, what can it do, what contract must
code preserve, and where does the reader go next?

## SDK Docs

The Tavern API is `@tavern/api`-defined, Runtime-hosted, and SDK-wrapped. It is
not just a description of today's tRPC or app-backend implementation.

Use this shape:

* **OpenAPI for chat and realtime.** `packages/tavern-api/openapi.yaml` owns
  public chat, message, response, activity, artifact, read, delivery, event,
  and error shapes.
* **Typed contracts for admin.** `packages/tavern-api/src/runtime/*`
  owns health, status, managed Hermes, agents, sessions, cron, skills, models,
  memory, files, and bindings.
* **Runtime handlers.** Tavern Runtime implements the contract.
* **SDK wrapper.** `@tavern/sdk` is the TypeScript client.
* **Docs explain behavior.** Markdown states ownership, durability, ordering,
  idempotency, recovery, and omissions.

SDK docs:

* **Lead with a quick start.** Show the smallest useful TypeScript example.
* **Name the public surface.** Messages, responses, activity, artifacts,
  receipts, history, events, admin, automations, webhooks, and bots.
* **Separate durable from notification.** Messages, responses, activity, and
  artifacts are durable. Events are notifications.
* **Show idempotency.** Duplicate ids or nonces return existing receipts.
* **Include examples.** Tavern App, bot, webhook, automation, and local tool
  examples use the real SDK surface.

Hermes is one runtime behind Tavern. Document it as an adapter,
not as the shape of the API itself.

## Internals Docs

Internals docs explain ownership and implementation. They are precise, but they
do not leak into feature language.

Use internals docs for:

* app/runtime boundaries
* always-on runtime chat server behavior
* database and runtime record layout
* frontend structure
* Hermes Gateway, managed runtime lifecycle, and adapter mapping
* sync paths and recovery
* testing architecture

Internals pages include implementation pointers and source files when useful.
Feature pages link here instead of duplicating internals.

## Operations Docs

Operations docs are recipes. They are executable, ordered, and easy to verify.

Use operations docs for:

* development setup
* testing gates
* release steps
* runtime upgrades
* managed Hermes lifecycle and upgrade steps
* local data reset or migration steps

Each operations page states when to run it, commands to run, expected results,
and cleanup or rollback notes when relevant.

## Writing Rules

* Use Tavern nouns at the product boundary: `chat`, `message`, `response`,
  `activity`, `artifact`, `agent`, `memory`, `Vault`, `automation`, `skill`,
  `stats`, `SDK`.
* Use runtime nouns only where runtime ownership matters: `session`, `turn`,
  `transcript`, `delivery`, `event`.
* Prefer "durable messages" over "chats survive reloads".
* Prefer "events notify; history recovers" over "websockets sync state".
* Prefer "cron automations with run history" over "scheduled work".
* Prefer "TypeScript SDK + bot example" over "API layer".
* Keep jokes and personality small. They clarify the product, not hide the
  contract.
* Put file paths, commands, env vars, and package names in backticks.
* Avoid bug-history prose. Capture the final rule, then link to issue or spec
  history only when needed.

## Review Checklist

Before merging docs changes:

* Does the README still read like a product front door?
* Is each new page in the right surface?
* Does every feature doc state what is in the box and what is missing?
* Are durable ids, ordering, idempotency, recovery, and ownership clear where
  they matter?
* Does SDK prose describe a stable app contract rather than today's plumbing?
* Are implementation details kept out of feature names?
* Are docs linked from a browsable index?
* Are status words clear enough that readers know what exists today?

## Maintenance

Keep docs aligned with source-of-truth code and contracts. When behavior moves,
update the page that owns the contract and delete stale transition notes instead
of adding compatibility narratives.
