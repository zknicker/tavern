---
name: tavern-widgets
description: Use when adding or changing Tavern Widgets, widget fence parsing, widget render contracts, generated agent Widget guidance, or seeded Widget chat demos. Covers the end-to-end checklist across @tavern/api, Runtime, Server, Website, docs, and tests.
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
   - `docs/adr/0010-widgets-use-tagged-fences.md`
4. Preserve unrelated dirty work.

## Vocabulary

- **Widget**: typed app-rendered UI block in chat, authored by the agent as a
  `widget:<name>` fenced code block containing one JSON object of props.
- **Widget name**: kebab-case fence tag, e.g. `bar-chart`.
- **Component id**: durable stored id, always `tavern.widget.<name>`.
- **Render envelope**: stored `{ component, fallback, props, target }` payload
  inside `widget` response activity metadata.

## Checklist

For each new Widget:

1. Add the props schema in `packages/tavern-api/src/widgets/<family>/contracts.ts`
   (or a new family folder).
   - Strict Zod schema; model-friendly shorthands may normalize via
     `.transform` (see the table matrix shorthand).
2. Register the Widget in `packages/tavern-api/src/widgets/contracts.ts`:
   - add the name to `widgetNameSchema`,
   - add the schema to `widgetPropsSchemasByName`,
   - add a `widgetRenderInputEntry` to `widgetRenderInputSchema`,
   - add a display name in `widgetDisplayName`, and widget-specific fallback
     text in `widgetFallbackText` when `title` alone is not enough.
3. Add a `WidgetPromptEntry` (`{ description, signature, constraints? }`) to the
   `widgetPromptEntries` map in `packages/tavern-api/src/widgets/prompt.ts`.
   - One decision-oriented description line plus a compact props signature; keep
     it small, it ships every turn.
   - The `satisfies Record<WidgetName, WidgetPromptEntry>` guard turns a missing
     entry into a compile error — that is the reminder, not this checklist.
   - Plugin-owned entries live beside their schema (see
     `widgets/merchbase/contracts.ts`) and are imported into the map.
4. Runtime needs no per-widget wiring: fence parsing in
   `apps/runtime/src/widgets/render.ts` covers all registered widgets, and
   `availableWidgetNamesForAgent` gates the prompt. A core widget (owned by no
   Plugin) is available to every agent automatically; a plugin widget appears
   only when the Plugin is enabled and granted (via the manifest `widgets`
   field), so no gating code is needed per widget.
5. Add the Website renderer:
   - a thin wrapper in `apps/website/src/widgets/` mapping fence props onto
     Tavern component kit components from `apps/website/src/kit/`
     (`KitFrame` for card framing; see `docs/internals/kit.md`),
   - a case in the `widgetElement` switch in
     `apps/website/src/widgets/render-widget.tsx`.
   - Never render model-provided HTML, JSX, CSS, class names, or component
     trees.
6. Plugin-owned Widgets declare themselves in the Plugin manifest `widgets`
   array and keep component source beside the Plugin where practical.
7. Seed a dev chat demo.
   - Use real Runtime chat rows via `widgetDemoRenderInput(name, fallback, props)`.
   - Plugin-owned Widgets use one `dev/<widget>.demo.ts` module per widget.
8. Add focused tests at the seams:
   - API: props parsing/normalization and `parseWidgetPayload` behavior;
     prompt assembly (`widgets/prompt.test.ts`).
   - Runtime: fence parsing, display-content stripping, activity projection
     (`apps/runtime/src/widgets/render.test.ts`). For a plugin widget, add a
     grant case to `plugins/agent-capabilities.test.ts`.
   - Website: transcript render + fallback (`chat-transcript.test.tsx`).
   - Instructions: generated prompt strings and gating
     (`apps/runtime/src/workspace/instructions.test.ts`).

## Standards

- Widget names: kebab-case, singular product nouns (`calendar-event`).
- Component ids: always `tavern.widget.<name>`; never freeform.
- Props are flat data. Interactivity lives in the React component, not in the
  payload. No state, actions, event handlers, or dynamic expressions.
- No centralized registry framework, manifest loader, or plugin system for
  first-party Widgets. Use the explicit schema map and renderer switch.
- Fallback/error state must stay visible to users.
- Invalid fences strip from the reply and produce no activity; never block the
  prose.

## Verify

Run the smallest lanes that cover changed seams. Common lanes:

```bash
cd packages/tavern-api && bun test src/widgets/ && bun run typecheck
bun run --filter @tavern/runtime test -- src/widgets/render.test.ts src/workspace/instructions.test.ts
cd apps/website && bun test src/features/chats src/widgets && bun run typecheck
bun run --filter @tavern/server typecheck
bun run lint
git diff --check
```
