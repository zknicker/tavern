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
  → `WorkingLog` group mode). The header is permanent and uses the
  `chat-transcript-tool-intents.ts` entrypoint to summarize the top tool intent
  families: "Read 2 files, searched code", "Rendered a calendar event", "Needs
  approval". Short commands, file paths, and first-party Widget targets can
  appear in the header; long commands, approval commands, browser payloads, and
  search queries stay in the drawer. Active headers latch meaningful copy and
  animate short text changes with SlotText, so fast tool state changes do not
  flash between raw commands and "Working". Expanding the drawer reveals the
  individual tool rows, which remain the inspect-drawer triggers.

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
renderer. If the collapsed group header uses the wrong family, update
`chat-transcript-tool-intent-catalog.ts`; if it exposes the wrong target, update
`chat-transcript-tool-intent-resolver.ts`; if the words or priority are wrong,
update `chat-transcript-tool-intent-copy.ts`.

## Worked example: tool approvals

Approval prompts intentionally use the normal tool-row renderer. The blocking
approval surface owns the user's choice, so the chat timeline stays an
execution log instead of a second approval UI:

1. The runtime records a pending prompt as an `approval` activity with the
   command and reason in `metadata.tool.arguments`
   (`apps/runtime/src/tavern/hermes-gateway-activities.ts`).
2. The activity projects as a tool row named `approval` (durable) and an
   `approval` progress step (live), both with the same row id.
3. `buildToolSummaryFromValues` summarizes the row with the command rather
   than the approval reason. The row/drawer can show the command, while the
   collapsed group header uses "Needs approval" so it does not flash a raw
   command while waiting.
4. The row falls through to `GenericToolStep`, inheriting the standard
   running shimmer, drawer behavior, and status colors.
5. The chat footer derives the oldest pending approval from loaded chat rows,
   previews the command from `row.approval.command`, overlays the prompt bar,
   blocks the composer, and renders `AskUserQuestions` with once, session,
   always, and deny choices.
6. The footer prompt calls `chat.approval.respond`, which reaches the engine
   gateway through the Runtime session approval endpoint.
7. The runtime completes the activity when the agent resumes, which flips the
   row to its settled state everywhere without app-side bookkeeping.

## Worked example: clarifications

The clarification row (`tool-steps/clarification-tool-step.tsx`, registered as
`clarify`) uses the same custom-renderer path:

1. Runtime records `clarify.request` as custom response activity with
   `metadata.clarification` and projects it as a `tool` step named `clarify`.
2. The renderer composes `ToolTimelineStep` with `AskUserQuestions` so choices,
   Other, Skip, and pending state live inside the work log.
3. The buttons call `chat.clarification.respond`, which reaches Runtime and the
   engine `clarify.respond` RPC.
4. Runtime owns the timeout and sends an explicit timeout answer before the
   engine fallback can fire.
