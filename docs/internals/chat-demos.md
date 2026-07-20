---
summary: Development chat demos for exercising Tavern chat UI through seeded Runtime chats.
read_when:
  - changing dev-only chat demos
  - changing seeded Runtime chat examples
  - replacing static chat preview routes with real chat data
---

# Chat Demos

Chat demos are dev-only Tavern chats seeded into Runtime SQLite. They let the app
exercise the normal chat list, chat detail, timeline, activity projection, Widget
rendering, and composer code paths without asking an agent to generate data.

Plugin-owned Widgets use one dev demo module per component:

```txt
apps/runtime/src/plugins/<plugin>/dev/<component>.demo.ts
```

The `.demo.ts` file owns the seeded chat rows, Widget payload, and any
inline fake data needed for that component's dev-only behavior. Do not add a
separate `.fixture.ts` file unless duplication becomes real and painful. The
demo always renders the real Widget; it must not provide a
dev-only renderer.

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

Core Tavern only aggregates Plugin dev demos. Plugin-specific operation names,
read cases, chart data, and disabled-state examples stay in the Plugin dev demo
module.

Composer queue demos are not seeded yet because queued draft messages are
app-local UI state, not durable Runtime chat rows.

## Current demos

| Chat | Demonstrates |
| --- | --- |
| `cht_demo` | A representative colored channel named `demo` covering chart Widgets, MerchBase chart rendering, the table Widget, calendar displays, artifact links, long-token wrapping, attachments, completed progress/tool work, stable tool drawer headers, sampled multi-turn history, and one stopped turn with thinking/progress/tool rows. |
| `cht_demo_team` | A multi-agent channel named `team` with two agent seats and per-seat turns. |
| `cht_demo_widgets` | A widget gallery channel named `widgets`: one turn per rendered widget in catalog order (table keyed and matrix shorthand, bar/line/composed charts, calendar event/day, HTML preview, HTML artifact and Wiki document cards that open in the pane, MerchBase sales chart) plus one intentionally invalid payload showing the fallback state. |
