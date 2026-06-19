---
name: tavern-widgets
description: Use when adding or changing Tavern Widgets, Widget tools, widget render contracts, host adapters, generated agent Widget guidance, or seeded Widget chat demos. Covers the end-to-end checklist across @tavern/api, Runtime, Server, Website, docs, and tests.
---

# Tavern Widgets

Use this skill to add or change a Tavern Widget end to end. Keep this file lean:
the canonical contract lives in repo docs and code.

## Start

1. Read repo `AGENTS.md`.
2. Run `bun run docs:list`.
3. Read the docs routed for Widgets and demos:
   - `docs/internals/widgets.md`
   - `docs/internals/chat-demos.md`
   - `docs/adr/0001-widgets-as-first-class-activity.md`
   - `docs/adr/0002-widgets-use-explicit-wiring.md`
4. Preserve unrelated dirty work.

## Vocabulary

- **Widget**: typed app-rendered UI block in chat or another known surface.
- **Widget tool**: narrow agent-facing tool that collects typed intent.
- **Widget component**: durable render component id plus props schema.
- **Host adapter**: Runtime, Server, or Website wiring for a widget family.

## Checklist

For each new Widget component:

1. Add `packages/tavern-api/src/widgets/<family>/contracts.ts`.
   - Export provider-safe tool name, durable component id, stored props schema,
     and tool input schema.
   - Stored props should be strict. Tool input may be forgiving when Runtime can
     normalize safely.
2. Add or update Runtime tool registration.
   - Keep the model-facing description compact and decision-oriented.
   - Name the user intent the tool satisfies, not only the input shape.
   - Keep JSON schema, validation, and TypeScript schema behavior in parity.
   - Return a short status result, not the full render payload.
3. Project successful tool completion into durable `widget` response activity.
   - Runtime owns chat/session/response routing; tool input must not include
     routing ids.
   - Store normalized props and deterministic fallback text.
4. Wire generic `ui.render` only through Runtime's generic widget activity path.
   Do not create widget-family stream event names.
5. Add the Server host adapter.
   - Generic host code parses the render envelope and owns unknown-component
     fallback after registered adapters decline.
   - Family adapters validate only their known component ids.
6. Add the Website adapter.
   - Validate again before rendering.
   - Use app-owned components, tokens, and `WidgetFrame` for inline chat widgets.
   - Never render model-provided HTML, JSX, CSS, class names, or component trees.
7. Add one short generated `AGENTS.md` Widget bullet.
   - One line per tool.
   - Phrase availability conditionally: use render tools when available, with a
     text/table fallback for non-Tavern channels.
   - No examples or implementation notes in generated prompt context.
8. Seed a dev chat demo.
   - Use real Runtime chat rows, not static routes or local transcript fixtures.
   - Use the real tool name for tool activity and the component id for widget
     render payloads.
9. Add focused tests at the seams:
   - API contract parsing and normalization.
   - Runtime tool/schema guidance and tool-to-widget projection.
   - Server fallback and known-component projection.
   - Website render/fallback behavior.
   - Generated `AGENTS.md` Widget bullet.

## Agent Adoption

- Treat tool descriptions and schemas as the primary agent-facing contract.
  Generated `AGENTS.md`, NOTES.md, and skills reinforce behavior but must not be
  the only place the agent learns when to render.
- When changing when an agent should choose a Widget, update the matching
  surfaces together: tool description/schema, generated `AGENTS.md` guidance,
  docs, and string tests.
- Keep domain skills focused on mapping user intent to source/API/CLI data and
  neutral chart-ready projections. Mention Tavern render tools only for local
  Tavern preferences and always include a non-render fallback.
- If the request is about behavior in a deployed managed agent, verify the
  actual runtime workspace and skill paths before claiming NOTES.md or skill
  edits apply there.

## Standards

- Tool names: provider-safe snake case, e.g. `render_bar_chart`.
- Component ids: durable Tavern namespace, e.g. `tavern.render_bar_chart`.
- No generic render-widget tool until a repeated pattern proves it is needed.
- No centralized registry, manifest loader, or plugin system for first-party
  widgets. Use explicit host imports and small switches.
- Fallback/error state must stay visible to users.
- ChatKit and AG-UI are reference semantics, not Tavern dependencies.

## Verify

Run the smallest lanes that cover changed seams. Common lanes:

```bash
bun run --filter @tavern/api test -- src/widgets/<family>/contracts.test.ts
bun run --filter @tavern/runtime test -- src/hermes/tavern-messenger-plugin.test.ts src/tavern/channel-relay.test.ts src/workspace/instructions.test.ts
bun test apps/server/src/widgets/<family>.test.ts
bun run --filter @tavern/server typecheck
bun run --filter @tavern/runtime typecheck
bun run --filter @tavern/runtime lint
git diff --check
```
