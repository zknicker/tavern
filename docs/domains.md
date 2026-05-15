# Domains

This document defines the product language Tavern should use across frontend and backend code.

## Product Domains

- `agents`
  Runtime-owned operators exposed through Tavern primitives, plus Tavern-owned presentation
  profiles such as avatar color overrides. Product UI currently presents one primary agent while
  retaining plural runtime projections internally.
- `chats`
  Durable conversation containers normalized across platforms. Chats are the primary reading
  surface and the primary write surface for posting messages into OpenClaw.
- `sessions`
  Runtime conversations or executions inside chats. Sessions remain first-class because they record
  what each agent actually did, but they are not the primary conversation surface.
- `participants`
  Non-agent actors observed from platforms, with manual links to Tavern profiles when the user
  chooses to associate them.
- `memories`
  Synced memory feed, summaries, filters, and memory-specific visualizations.
- `jobs`
  Internal Tavern jobs, executions, and job-related status views.
- `workers`
  Observed autonomous background agent work synced from OpenClaw and materialized as
  inspectable Tavern-owned worker records.
- `models`
  Curated model catalog, provider access, surface-specific routing policy, and
  model-oriented status or usage presentation.
- `skills`
  Runtime skill packages, installation, preview, and primary-agent skill enablement.

## Platform Capabilities

- `connections`
  Runtime connectivity, platform accounts, and messaging platform bindings.
- `sync`
  Freshness, invalidation, reconciliation, and materialization state.

## Platform Terms

Discord, Telegram, iMessage, and similar transports are platform concepts under OpenClaw.
They should not become generic product domains. The OpenClaw adapter normalizes platform payloads into
Tavern chats, sessions, messages, agents, and participants.

## Workflow Surfaces

- `overview`
- `settings`
- `onboarding`

These are composition areas, not domain primitives.

## Not Domains

Do not introduce top-level app domains for these when a real owner exists:

- `activity`
- `provider`
- `health`
- `theme`
- `logs`
- `shared`

Use these as projections, platform capabilities, UI details, integration details, or feature-local
terms under a real domain.
