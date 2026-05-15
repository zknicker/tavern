# OpenClaw Tavern Messenger

`@zknicker/tavern-openclaw-messenger` is the first-party OpenClaw channel plugin for Tavern chats.

Install this package into an OpenClaw Gateway, then configure Tavern with that Gateway. Tavern uses
Tavern Runtime's local channel relay for turn intake:

```txt
Tavern Server
  -> Tavern Runtime /chat
  -> Tavern Messenger inbound-message
  -> Tavern Messenger channel turn
  -> OpenClaw agent/session execution
  -> OpenClaw shared message lifecycle
  -> Tavern Messenger text delivery
```

The plugin accepts plain text and Tavern-owned message metadata, such as tool mentions, and passes
that metadata into the channel turn context.

V1 is intentionally small:

- one Tavern chat has one bound OpenClaw agent
- text-only sends
- single-threaded, long-lived chats
- no ACP and no generic `sessions.send` fallback

The plugin does not store dynamic Tavern chat registrations and does not expose Tavern-specific
Gateway RPCs for chat management or turn start. Tavern Server owns app chat existence, bindings, and
labels in Tavern DB. Tavern Runtime only relays in-flight channel frames between Tavern Server and
this plugin.

## Architecture Principles

- Tavern is the client surface. OpenClaw is the runtime. The plugin is the native channel contract
  between them.
- Tavern chat identity is the chat UUID. Do not derive it from the sender, label, delivery
  metadata, or a prefixed variant.
- Tavern Server owns Tavern channel registration. The plugin owns channel turn intake after Runtime
  delivers an `inbound-message` frame.
- OpenClaw core owns the shared `message` tool and final reply send lifecycle. The plugin exposes
  an Tavern channel `message` adapter and implements only the Tavern-native text delivery side
  effect.
- Session keys come from OpenClaw's channel routing. Tavern should send with the synced session key,
  not derive session keys from chat ids or delivery metadata.
- Runtime history remains runtime-owned. Tavern syncs projections and may render optimistic UI, but
  the plugin must not create a second durable transcript.
- Bad identity is a hard failure. Do not recover Tavern chat identity from labels, origin strings,
  delivery metadata, or stale local records.

## Session Model

Tavern chats are first-party, durable chat containers. In OpenClaw terms, each Tavern chat should be
its own session for the bound agent. The plugin must not route Tavern chat traffic through the
agent's shared `main` session.

The OpenClaw route is intentionally:

```txt
chatType: channel
peer.kind: channel
peer.id: <tavern-chat-uuid>
to: chat:<tavern-chat-uuid>
```

That keeps Tavern chat semantics aligned with OpenClaw's channel-scoped session routing. The
expected session key shape is:

```txt
agent:<agent-id>:tavern:channel:<tavern-chat-uuid>
```

Do not change this to `chatType: direct` or `peer.kind: direct`. OpenClaw's default direct-message
scope can collapse direct routes to `agent:<agent-id>:main`, which means Tavern would be sending into
the agent's main session instead of the selected Tavern chat.

## Data Flow

```txt
Tavern app
  creates/selects an Tavern chat
  sends text for the selected session key
        |
        v
Tavern server
  validates one bound agent
  posts to Tavern Runtime for relay
        |
        v
Tavern Runtime
  forwards an inbound-message frame over /chat
  stores no durable chat or transcript data
        |
        v
Tavern Messenger plugin
  validates chat + agent + expected session key
  dispatches the OpenClaw channel turn
  delivers final replies through the channel message adapter
        |
        v
OpenClaw session
  agent:<agent-id>:tavern:channel:<tavern-chat-uuid>
```

## OpenClaw Boundary

Tavern server code creates Tavern chats and stores local projections. Tavern Runtime manages the
OpenClaw process and exposes the private relay that carries Tavern channel messages into this
plugin. OpenClaw core implements final reply and `message(action="send")` dispatch through the
plugin's channel `message` adapter.

## Gotchas

- `tavern:<uuid>` is not a valid Tavern Messenger chat id.
- `agent:<agent-id>:main` is not a valid Tavern chat session.
- `direct` chat routing is wrong for Tavern chats, even when there is only one user and one agent.
- Tavern sender is message actor metadata, not the OpenClaw session peer.
- Adapter-side cleanup that makes bad OpenClaw records look correct hides integration bugs.
