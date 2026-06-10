# Unmapped Hermes Gateway Events (Plan B)

Status: planned. Wire the gateway events `apps/runtime/src/hermes/local-client.ts`
currently drops (a one-time `warnUnhandledGatewayEvent` console.warn fires for
each). Gateway source of truth: github.com/NousResearch/hermes-agent,
`tui_gateway/server.py` (see `_emit` call sites and `_agent_cbs`). Fetch via
`gh api repos/NousResearch/hermes-agent/contents/tui_gateway/server.py --jq
.content | base64 -d`. Read `docs/internals/tool-presentation.md` and
`docs/api/realtime.md` first.

Four items, in order:

## B1. `message.start` (trivial)

Map in `local-client.ts` streamChat to a `turn.replyUpdated` yield with
`isThinking: false, text: ''` so the chat indicator flips Thinking → Typing
when composing starts instead of on the first delta.

## B2. `notification.show` / `notification.clear` (small)

Agent notices (e.g. credits). Pin the payload from the gateway's
`notice_callback`, then record as a `runtimeNotice` activity using the
existing pattern (`recordSteeredTurnNotice` in
`apps/server/src/agent-runtime/event-sync.ts`, projection in
`runtimeNoticeFromActivity` in `apps/server/src/chat/runtime-chat-api.ts`).
`clear` completes the activity. Renders as the existing system notice row —
no new UI.

## B3. `subagent.*` → worker rows (medium)

The gateway emits spawn-tree progress: goal, task_count/index, subagent_id,
parent_id, depth, model, status, summary, token/cost rollups, files, duration.
Map `subagent.start/tool/complete` in `local-client.ts`, record activities in
`apps/runtime/src/tavern/hermes-turn-runner.ts` with `metadata.subagent`
source facts (AGENTS.md adapter rule: project facts, never author
presentation), and project them as `kind: 'worker'` chat rows in
`runtime-chat-api.ts` so the existing WorkerStep renderer
(`apps/website/src/features/chats/chat-transcript-activity-step.tsx`) and live
group labels light up. Token/cost rollups stay in metadata for Stats later.

## B4. `approval.request` (largest — needs a response channel)

Tool-approval prompts can stall a turn invisibly today.

1. Discovery FIRST: from the gateway source, pin (a) the `approval.request`
   payload and (b) the RPC a client uses to respond (search
   `register_gateway_notify` / approval resolution in `server.py`). The plan
   hinges on this.
2. Reality check: confirm whether Tavern's managed Hermes config can trigger
   approvals at all. If approval-free, ship only the visibility half.
3. Visibility: map the event → activity + `turn.progress` step kind
   `'approval'` (already in `ChatTurnProgressStep` and the tavern-api step
   schema) so a pending approval shows in the work log instead of a silent
   stall, with the live tail showing a waiting state.
4. Respond path (if applicable): runtime endpoint → `@tavern/api` contract +
   SDK → server tRPC procedure → gateway RPC. UI: Approve/Deny buttons via a
   custom step renderer registered in
   `apps/website/src/features/chats/tool-steps/registry.tsx` (the documented
   extension point).
5. Docs: `docs/api/realtime.md` (new events), `docs/features/chat.md`, and
   the tool-presentation doc gains the approval renderer as a worked example.

## Verification

Per layer: apps/runtime vitest + tsc; apps/server bun test + tsc; apps/website
`bun test src` + tsc; ultracite everywhere. Update docs in the same pass.
