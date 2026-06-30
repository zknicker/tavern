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
* Runtime startup seeds the `cht_demo` channel only when that flag is present.
* Demo rows use stable `cht_`, `msg_`, `rsp_`, and `act_` ids so seeding is
  idempotent across restarts.
* Demo response activity is replaced from the current demo definition on each
  seed, so changed demo activity sequences do not leave stale rows behind.
* The demo channel is a normal Tavern chat. It appears in the sidebar channel list
  with seeded channel color and opens through `/chats/:id`.
* Do not add a separate Demos tab, lab route, or preview-only page for them.
* The demo channel is single-user, single-agent unless the product explicitly brings back
  multi-user or multi-agent chat support.
* Obsolete per-feature demo chats are removed during dev seeding so local
  workspaces converge back to the single `demo` channel without stale stable-id
  conflicts.

Do not add route-local transcript fixtures for demo coverage. If a demo needs to
show a chat behavior, seed the Runtime rows that live chat would read.

Composer queue demos are not seeded yet because queued draft messages are
app-local UI state, not durable Runtime chat rows.

## Current demos

| Chat | Demonstrates |
| --- | --- |
| `cht_demo` | A representative colored channel named `demo` covering chart Rich Responses, MerchBase chart rendering, Rich Response primitives, calendar displays, artifact links, long-token wrapping, attachments, completed progress/tool work, stable tool drawer headers, sampled multi-turn history, and one final running turn with thinking/progress/tool rows. |
