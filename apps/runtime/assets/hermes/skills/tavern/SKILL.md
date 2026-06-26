---
name: tavern
description: >
  Use for Tavern-specific inspection: chats, agent settings, connectors,
  skills, Runtime health, Memory status, and where settings live.
---

# Tavern

Managed by Tavern Runtime. Do not edit this skill directory; Runtime refreshes
it on startup. For durable agent-managed skill changes, create or update a
separate skill in your normal skills directory.

Tavern is the chat app you live in. The user talks to you in Tavern chats; your
configuration, skills, connectors, and durable memory are Tavern product
surfaces. This skill is your map for reading those surfaces and pointing the
user to the right setting.

Core nouns: a **chat** is the durable conversation; your work runs in
**sessions** inside chats; **automations** are scheduled runs that deliver
results into a chat; **Memory** is the browsable durable knowledge store.

## The Tavern API

Tavern Runtime serves a local HTTP API at `$TAVERN_RUNTIME_URL` (loopback,
trusted local owner). Every call needs your runtime token:

```sh
AUTH="authorization: Bearer $TAVERN_RUNTIME_TOKEN"
```

Reads are always safe. Use `curl` with JSON output.

Replying in the current conversation is just your normal answer — never an API
call. Use the API only to inspect Tavern state.

### Chats and messages

```sh
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats?limit=50"                      # list chats
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats/<chat_id>/messages?limit=50"   # history
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/api/chats/<chat_id>/messages/search?query=<text>"
```

### Read your own configuration (read-only)

```sh
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/agents"                # your record (name, skills)
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/execution-settings"    # model fallbacks, timezone, web extract summarizer
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/permission-settings"   # approval modes, command allowlist
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/connectors"            # MCP servers (secrets masked)
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/skills"                # available skills
curl -s -H "$AUTH" "$TAVERN_RUNTIME_URL/capabilities"          # runtime health
```

Use these to answer "what model am I using?", "what are you allowed to run?",
or "which connectors do I have?" with facts instead of guesses.

## Settings map

You cannot change Tavern settings yourself. When a change belongs to settings,
direct the user to the exact place:

| The user wants to change | Where |
| --- | --- |
| Your model, thinking effort, fallback models | Settings -> Agent |
| Your name, color | Settings -> Agent (Appearance) |
| Timezone | Settings -> Agent (Behavior) |
| What you may run without asking | Settings -> Agent (Permissions) |
| Durable notes and instructions / personality | Settings -> NOTES.md / SOUL.md |
| Skills and toolsets | Settings -> Skills & Toolsets |
| MCP servers | Settings -> Connectors |
| MerchBase and other first-party Plugin settings | Settings -> Plugins |
| Model provider accounts and keys | Settings -> Models |
| Memory health | Settings -> Tavern Runtime |
| Browsable Memory files | Settings -> Memory |

## Boundaries

- Never edit Tavern configuration files, the generated runtime config, or
  stored settings directly; settings changes go through the user.
- Never read or echo secret values; connector and provider secrets are
  intentionally masked. `$TAVERN_RUNTIME_TOKEN` is a credential too: send it
  in headers, never print it.
- Everything you post through the API is attributed to you and permanently
  visible in chat history — no hidden side channels.
