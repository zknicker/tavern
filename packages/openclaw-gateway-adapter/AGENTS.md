# OpenClaw Gateway Adapter

This package adapts the OpenClaw Gateway WebSocket protocol to Tavern's
`@tavern/api`.

## Boundaries

- Do not import `apps/server` or app UI code.
- Do not read `~/.openclaw`, OpenClaw config files, workspace files, or databases directly.
- Do not shell out to `openclaw` for normal runtime operations.
- Use OpenClaw Gateway RPC and events as the only OpenClaw integration surface.
- Return Tavern API and runtime evidence shapes at the package boundary.
- Keep OpenClaw-native request and response shapes inside `src/gateway` and `src/mappers`.

## Mapper Layout

Mirror server-side API organization. Put one mapper operation per file:

- `mappers/agents/list.ts`
- `mappers/agents/get.ts`
- `mappers/cron/create.ts`
- `mappers/sessions/messages.ts`

Use domain-local `shared.ts` files only when multiple files in that same domain need the same
helpers. Avoid global mapper helper buckets unless the helper is genuinely cross-domain and stable.

## Platform Layout

OpenClaw is the agent runtime. Discord, Telegram, Slack, and similar systems are platforms surfaced
through OpenClaw.

Keep platform-specific parsing in `src/platforms/<platform>/`, not in generic primitive mappers.
For example:

- `platforms/discord/conversation.ts` resolves Discord channel and DM identity.
- `platforms/discord/participant.ts` normalizes Discord users into Tavern chat participants.

Generic mappers should consume platform-normalized facts and emit Tavern API records. Do not
let raw platform fields such as Discord session key fragments, `lastTo`, or `origin.to` leak through
the package boundary.

When platform-specific facts are useful to Tavern, put them in typed `platformMetadata`. Do not
hide those facts inside derived chat names or loose metadata. `metadata` is for runtime projection
bookkeeping such as session keys; `platformMetadata` is for Discord, Telegram, Slack, and similar
source facts.

## Captured Sample Tests

Use sanitized Gateway samples from `src/test-data/` for mapper contract tests. Raw captures belong
in `.context/openclaw-captures/` and must not be committed.

Mappers must not invent required ids, schedules, timestamps, actor identities, or agent file
contents. Reject incomplete Gateway records instead of filling them with random ids, `default`,
`main`, the current time, or empty file content.

For message sends, require a synced `target.sessionKey`. Do not derive Discord channel, Discord DM,
or opaque OpenClaw session keys from chat targets.

## Protocol Fit

If OpenClaw cannot map cleanly to a Tavern API shape, do not hide that with lossy behavior.
Return an explicit unsupported error, document the gap in `README.md`, and propose a protocol
change before adding broad compatibility hacks.
