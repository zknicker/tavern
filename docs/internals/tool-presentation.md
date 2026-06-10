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
- **Every contiguous tool group renders as a collapsed work drawer from its
  first step** (`apps/website/src/features/chats/chat-transcript-activity.tsx`
  → `WorkingLog` group mode). The header is permanent — while the group
  executes it carries the active tool's icon and synopsis with the running
  shimmer; at rest it carries the count summary ("Ran 2 commands, searched
  web 1 time"). Growth retexts the header; it never restructures the rows.
  Expanding the drawer reveals the individual tool rows, which remain the
  inspect-drawer triggers.

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

## Worked example: tool approvals

The approval row (`tool-steps/approval-tool-step.tsx`, registered as
`approval`) shows the full custom-renderer shape:

1. The runtime records a pending prompt as an `approval` activity with the
   command and reason in `metadata.tool.arguments`
   (`apps/runtime/src/tavern/hermes-gateway-activities.ts`).
2. The activity projects as a tool row named `approval` (durable) and an
   `approval` progress step (live), both with the same row id.
3. The renderer composes `ToolTimelineStep` + `InlineToolLabel` for the
   shimmer/drawer behavior and adds Approve/Deny buttons as row children
   while the row is running. The buttons call `chat.approval.respond`, which
   reaches the engine gateway through the Runtime session approval endpoint.
4. The runtime completes the activity when the agent resumes, which flips the
   row to its settled state everywhere without app-side bookkeeping.
