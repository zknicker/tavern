---
name: tavern
description: >
  Tavern operations and product knowledge for the resident Tavern agent. Use it
  to find, read, or search Tavern chats, post an update into another chat,
  set up scheduled work that delivers into a chat, read your own configuration,
  or answer questions about Tavern itself — what it can do, what settings exist,
  and where the user changes them. Activates when the user mentions Tavern,
  their chats, schedules or automations, agent settings, connectors, skills,
  memory, or asks what you can do.
---

# Tavern

Tavern is the chat app you live in. The user talks to you in Tavern chats; your
configuration, skills, connectors, schedules, and durable memory are all Tavern
product surfaces. This skill is your map of that home: how to operate it and
how to advise the user about it.

Core nouns: a **chat** is the durable conversation; your work runs in
**sessions** inside chats; **automations** are scheduled runs that deliver
results into a chat; **Cortex** is the durable knowledge store (see the `wiki`
skill for all knowledge work).

## The Tavern API

Tavern Runtime serves a local HTTP API at `$TAVERN_RUNTIME_URL` (loopback,
trusted local owner). Every call needs your runtime token:

```sh
AUTH="authorization: Bearer $TAVERN_RUNTIME_TOKEN"
```

Reads are always safe. Use `curl` with JSON output.

Replying in the current conversation is just your normal answer — never an API
call. Use the API to reach **other** chats or to inspect state.

### Chats and messages

```sh
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats?limit=50"                      # list chats
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats/<chat_id>/messages?limit=50"   # history
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats/<chat_id>/messages/search?query=<text>"
```

### Post a message into a chat

Only when the user asks you to send something to another chat. The message is
attributed to you and appears in that chat's history like any of your replies.
Pick a fresh `deliveryId` (repeat it to retry idempotently).

```sh
curl -s -X POST "$TAVERN_RUNTIME_URL/cron/deliveries" \
  -H "$AUTH" -H 'content-type: application/json' \
  -d '{"chatId":"cht_...","content":"...","deliveryId":"del_<unique>"}'
```

### Read your own configuration (read-only)

```sh
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/agents"                # your record (name, avatar, skills)
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/execution-settings"    # model fallbacks, timezone
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/permission-settings"   # approval modes, command allowlist
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/connectors"            # MCP servers (secrets masked)
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/skills"                # available skills
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/capabilities"          # runtime health
```

Use these to answer "what model am I using?", "what are you allowed to run?",
or "which connectors do I have?" with facts instead of guesses.

## Automations

Use your scheduling tools to create recurring or one-time jobs. Results deliver
into a Tavern chat through the Tavern delivery platform; the user sees runs and
history in the app. When a user asks for "a morning summary" or "check X every
hour", that is an automation: schedule it, confirm the delivery chat, and tell
the user where it will appear.

## Settings map

You cannot change Tavern settings yourself. When a change belongs to settings,
direct the user to the exact place:

| The user wants to change | Where |
| --- | --- |
| Your model, thinking effort, fallback models | Settings -> Agent |
| Your name, avatar, color | Settings -> Agent (Appearance) |
| Timezone | Settings -> Agent (Behavior) |
| What you may run without asking | Settings -> Agent (Permissions) |
| Durable notes and instructions / personality | Settings -> NOTES.md / SOUL.md |
| Skills and toolsets | Settings -> Skills & Toolsets |
| MCP servers | Settings -> Connectors |
| Model provider accounts and keys | Settings -> Models |
| Durable memory (Cortex wiki) | Settings -> Wiki |

## Boundaries

- Never edit Tavern configuration files, the generated runtime config, or
  stored settings directly; settings changes go through the user.
- Never read or echo secret values; connector and provider secrets are
  intentionally masked. `$TAVERN_RUNTIME_TOKEN` is a credential too: send it
  in headers, never print it.
- Everything you post through the API is attributed to you and permanently
  visible in chat history — no hidden side channels.
