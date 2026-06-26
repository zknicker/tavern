---
summary: Development chat demos for exercising Tavern chat UI through seeded Runtime chats.
read_when:
  - changing dev-only chat demos
  - changing seeded Runtime chat examples
  - replacing static chat preview routes with real chat data
---

# Chat Demos

Chat demos are dev-only Tavern chats seeded into Runtime SQLite. They let the app
exercise the normal chat list, chat detail, timeline, activity projection, Rich Response
rendering, and composer code paths without asking an agent to generate data.

## Contract

* The dev stack sets `TAVERN_DEV_STACK=1`.
* Runtime startup seeds demo chats only when that flag is present.
* Demo chats use stable `cht_`, `msg_`, `rsp_`, and `act_` ids so seeding is
  idempotent across restarts.
* Demo response activity is replaced from the current demo definition on each
  seed, so changed demo activity sequences do not leave stale rows behind.
* Demo chats are normal Tavern chats. They appear in the sidebar `Chats` list and
  open through `/dashboard/chats/:id`.
* Do not add a separate Demos tab, lab route, or preview-only page for them.
* Demos are single-user, single-agent unless the product explicitly brings back
  multi-user or multi-agent chat support.

Do not add route-local transcript fixtures for demo coverage. If a demo needs to
show a chat behavior, seed the Runtime rows that live chat would read.

Composer queue demos are not seeded yet because queued draft messages are
app-local UI state, not durable Runtime chat rows.

## Current demos

| Chat | Demonstrates |
| --- | --- |
| `cht_demo_activity_turn` | Assistant progress messages and grouped tool activity in one completed turn. |
| `cht_demo_artifact_links` | Assistant Markdown links that open inspectable Vault and workspace targets in the Artifact Panel. |
| `cht_demo_approval_flow` | A running response blocked on approval activity. |
| `cht_demo_attachment` | Durable user message attachment rendering. |
| `cht_demo_calendar_day` | Calendar Day Rich Response activity rendered inline in a real chat. |
| `cht_demo_calendar_event` | Calendar Event Rich Response activity rendered inline in a real chat. |
| `cht_demo_charts` | Bar, Line, and Composed Chart Rich Response activity rendered inline in one real chat. |
| `cht_demo_composed_chart` | Composed Chart Rich Response activity rendered inline in a real chat. |
| `cht_demo_line_chart` | Line Chart Rich Response activity rendered inline in a real chat. |
| `cht_demo_long_content` | Long pasted JSON and long URL wrapping. |
| `cht_demo_rich_response_catalog` | Stack, Heading, Text, Separator, and Table Rich Response components rendered inline in one real chat. |
| `cht_demo_streaming_stack` | Running turn with thinking, progress, and tool stack rows. |
| `cht_demo_tool_headers` | Stable collapsed tool drawer headers for mixed work, approval, and a live running group. |
| `cht_demo_turn_timeline` | Twenty completed back-and-forth turns for exercising the chat turn timeline rail. |
