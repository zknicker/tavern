# Tavern Messenger Agent Guide

This package is Tavern's first-party OpenClaw channel plugin. It must integrate with OpenClaw's
channel and session routing model directly. Do not make Tavern appear correct by rewriting adapter
output after OpenClaw has created the wrong session.

## Core Principles

- Tavern chat identity is a durable `cht_` id. Do not introduce an `tavern:` chat-id namespace.
- Do not derive Tavern chat identity from the sender, label, delivery metadata, or a prefixed
  variant.
- Tavern chats are room-like runtime conversations, even when they contain one agent.
- One Tavern chat maps to one OpenClaw session per bound agent.
- Tavern sender is message actor metadata, not the OpenClaw session peer.
- Tavern owns product projection and UI state. OpenClaw owns native sessions, turns, tools, and
  durable runtime history.
- The OpenClaw Gateway adapter maps valid plugin output into Tavern API and runtime evidence
  records. It must not repair invalid plugin routing.

## OpenClaw Routing Rules

- Tavern chats are durable Tavern conversation containers.
- One Tavern chat maps to one OpenClaw session per bound agent.
- Tavern chats are OpenClaw channel chats, not OpenClaw direct messages.
- Build routes through OpenClaw's channel SDK, especially `buildChannelOutboundSessionRoute`.
- For Tavern chat routes, use `chatType: "channel"` and `peer.kind: "channel"`.
- Tavern chat ids use the `cht_` prefix. Preserve that id shape in route construction.
- The expected OpenClaw session key shape is
  `agent:<agent-id>:tavern:channel:<tavern-chat-id>`.
- Never let Tavern chat routing collapse to `agent:<agent-id>:main`.
- Never override a derived Tavern route with `currentSessionKey`.
- Never manually fabricate final session records in the Tavern adapter to hide bad plugin routing.

Why channel semantics matter: OpenClaw's default `session.dmScope` for direct peers can route DMs to
an agent's main session. Tavern chats are room-like first-party conversations, so both the OpenClaw
peer and chat type should be channel-scoped.

## Failure Policy

- If an Tavern session has no stable Tavern chat id, fail.
- If a Tavern chat id does not use the `cht_` prefix, fail.
- If an Tavern session is observed as `agent:<agent-id>:main`, fail.
- If a send does not use the synced session key for the selected Tavern chat and agent, fail.
- If the plugin cannot validate the requested chat id, agent id, and session key together, fail.
- Do not add defensive fallbacks that recover Tavern identity from labels, origin strings, delivery
  metadata, stale `tavern:<uuid>` ids, or stale `main` session records.

Bad runtime records should be visible during sync or tests. Silent recovery makes Tavern look like it
is using the correct session while OpenClaw is actually executing in the wrong one.

## Package Boundaries

- `src/channel.js` owns OpenClaw channel route shape.
- `src/runtime-relay.js` owns the private Tavern Runtime relay connection.
- `src/turn.js` validates inbound Tavern channel messages, agent ids, and session keys before
  dispatching an OpenClaw turn.

The OpenClaw Gateway adapter may map valid Tavern Messenger records into Tavern API and runtime
evidence records, but it must not repair invalid Tavern Messenger routing.

## Runtime Boundary

Tavern application and server code should talk to Tavern Runtime. Runtime relays Tavern channel
frames into the plugin and hides the managed OpenClaw Gateway from product code. Do not reintroduce
Tavern chat-management or turn-start Gateway RPCs.

## Operator Notes

- Deploy this plugin as an OpenClaw package plugin. Restart the Gateway when changed plugin bytes
  must be reloaded.
- If stale local or Gateway data has the wrong id/session shape, clean that data explicitly. Do not
  add compatibility code to preserve it.
- Keep docs focused on architecture and invariants. Avoid copying method signatures or code paths
  that are obvious from the source.
