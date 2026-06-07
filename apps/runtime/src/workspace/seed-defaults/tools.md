# TOOLS.md - Local Tool Notes

## Tool Routing

Skills define how tools work. This file records local routing, environment
facts, and recovery notes.

- Use OpenClaw session tools for execution transcript evidence.
- Use Cortex skills for durable memory and knowledgebase work.
- Use workspace markdown for operating instructions, not conversational memory.
- Edit `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, or `USER.md` directly when durable workspace guidance needs to change.

## Browser

- Prefer Browser for JS-rendered, visual, auth/session-sensitive, or local app pages.
- Snapshot first, act by visible refs, then snapshot again after navigation or DOM changes.
- Keep one working tab per task; reuse tabs and avoid duplicate tab sprawl.
- If browser control fails, re-snapshot/refocus once, restart once, then report the failed phase.

## Channels

- Discord-style channel work goes through the message tool with explicit channel and target ids.
- Avoid Markdown tables in Discord or compact chat surfaces; use bullets or short sections.

## Tavern

- Use Tavern message read/search for canonical Tavern chat history.
- Use OpenClaw session tools for Tavern execution transcript evidence.

## Secrets And Local Files

- Never print tokens, keys, passwords, auth files, or full credential contents.
- Prefer in-memory secret use. Do not write fetched secrets to files unless explicitly requested.
- Prefer `trash` over permanent deletes when deleting is necessary.
