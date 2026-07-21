---
summary: Decision to model threads as child conversation containers (own chat row, id, and sequence space) with per-participant follow records, replacing inline replies entirely.
read_when:
  - changing thread storage, creation, follows, or unread rollup
  - changing reply affordances or per-message reply context
  - adding surfaces anchored on a message (tasks, reminders, file comments)
---

# ADR 0013: Threads Are Child Conversation Containers

## Status

Accepted. Part of the Raft-alignment program (`specs/raft-alignment/README.md`,
decisions T1/T2/T3/U5). Normative contract: `specs/threads.md`.

## Context

Tavern had two vestigial reply mechanisms: a `parent_message_id` inline-reply
pointer whose only effect was a `Reply context:` section in the per-turn agent
prompt, and an unused `thread_root_id` column anticipating Slack-style
in-chat threading. Neither was exposed to the web client, and agents never
set either field. Raft — audited at the wire layer (daemon source, npm CLI
bundle, live docs) — models a thread as a first-class child conversation:
`channel_type: "thread"`, its own name and sequence domain, parent-channel
pointers, and per-participant follow records derived from parent membership.

## Decision

- A thread is a `chats` row (`kind: 'thread'`) with `parent_chat_id` and
  `anchor_message_id`, its own deterministic id
  (`cht_thr_<anchor-msg-id>`), and its own per-chat sequence space. First
  reply creates it; no nesting; membership always derives from the parent.
- `thread_follows` records attention per participant, humans and agents
  identically: participate/@mention auto-follows, posting re-follows,
  mentions pierce without re-following.
- Inline replies retire completely: `parent_message_id`, `thread_root_id`,
  and the `Reply context:` prompt section are deleted, not deprecated.
- Full message immutability posture: no edit/delete paths, no tombstones.
  The caller-less `deleteMessage` primitive and its route were removed.
- Followed-thread unreads fold into the parent chat's `unread_count`;
  threads never appear in the sidebar chat list.

## Consequences

- Every message-anchored surface (task work threads, reminder receipts, file
  comments) gets one uniform container with ordinary chat mechanics — seq,
  reads, events — for free.
- Thread display names derive at read time from the parent handle + 8-char
  anchor short id (`#channel:shortid`, `dm:@name:shortid`), matching the
  CLI target grammar (D2) so renames propagate by construction.
- Existing databases carry dead `parent_message_id`/`thread_root_id`
  columns; the stale `chats.kind` CHECK constraint is rebuilt by the
  startup schema-repair path (the same guarded rebuild that added the
  `task` kind), so upgrades need no manual step.
