---
summary: Tool call presentation pipeline — server label shaping, inline row renderers, and the tool-aware drawer registry, with extension points for custom tools.
read_when:
  - adding a custom row or drawer presentation for a specific tool name
  - changing tool row labels, verbs, running/completed states, or the inspect drawer
  - changing how tool arguments or results are summarized for the chat timeline
---

# Tool Presentation

How a tool call becomes a chat row and an inspect drawer, and where to plug in
custom presentation for a specific tool.

## Pipeline

1. **Runtime** stores each tool call as a response activity with full
   `metadata.tool.arguments` and `metadata.tool.result`
   (`apps/runtime/src/tavern/hermes-turn-runner.ts`). Nothing is truncated at
   this layer.
2. **Server projection** turns activities into timeline tool rows
   (`apps/server/src/chat/runtime-chat-api.ts`). Row labels come from
   `buildToolSummaryFromValues` (`apps/server/src/tools/summary.ts`).
3. **Row rendering** resolves a step component by tool name
   (`apps/website/src/features/chats/tool-steps/registry.tsx`).
4. **Drawer rendering** fetches the full call (`chat.tool.get` /
   `session.tool.get` — untruncated) and resolves a body component by tool
   name (`apps/website/src/features/sessions/tools/tool-drawer-registry.tsx`).

## Rules

- **Row labels describe intent, never outcome.** `summaryParts` derive only
  from tool arguments (command, path, pattern). Results belong in the drawer.
  Tests in `apps/server/src/tools/summary.test.ts` pin this.
- **Color is signal.** Completed verbs are neutral; red is reserved for
  failures; running rows shimmer (`thinking-indicator-text`).
- **The whole row opens the drawer.** The step row is the drawer trigger; the
  magnifier icon is a hover hint, not the click target.
- Single-tool activity groups render the step directly; the collapsed group
  disclosure only appears for two or more steps
  (`apps/website/src/features/chats/chat-transcript-activity.tsx`).

## Adding custom presentation for a tool

Both registries resolve by normalized tool name: exact match, then substring
match, then a generic fallback. A business-specific tool usually needs one or
both of:

1. **Custom inline row** — add a renderer to `toolStepRenderers` in
   `apps/website/src/features/chats/tool-steps/registry.tsx`. It receives
   `ToolStepRendererProps` (`tool-steps/types.ts`) and should compose
   `ToolTimelineStep` + `InlineToolLabel` so it inherits the drawer trigger,
   enter animation, running shimmer, and status colors.
2. **Custom drawer body** — add a renderer to `toolDrawerBodyRenderers` in
   `apps/website/src/features/sessions/tools/tool-drawer-registry.tsx`. It
   receives `{ call: ToolDrawerCall }` (`tool-drawer-call.ts`) with the full
   arguments record and result. Compose the shared blocks in
   `tool-drawer-blocks.tsx` (mono blocks, copy buttons, section labels) so the
   drawer stays visually consistent. `resolveToolDrawerIcon` rides the same
   lookup for the header icon.

If the default row label is wrong for the tool, fix it at the source in
`buildSummaryParts` (`apps/server/src/tools/summary.ts`) rather than in a row
renderer — the label is shared by chat rows, group headers, and the live
"working" summary.
