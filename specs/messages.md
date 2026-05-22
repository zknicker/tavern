# Messages

Messages are Tavern's normal conversational interactions.

## Product Expectations

- A message is the primitive for normal assistant and participant output in chats and sessions.
- A message is not a tool interaction, worker, or generic system event.
- Messages feel consistent across chats and sessions.

## Identity And Content

- A message has stable identity, timestamp, author, and text.
- A message preserves who said it and when.
- A message may carry model and provider metadata when Tavern has it.
- A user-authored message may carry Tavern-owned presentation metadata for inline tool mentions.
- Tool mention metadata does not make a message a tool interaction and does not grant tool access.

## Relationships

- A message belongs to a chat, a session, or both.
- A message is authored by an agent or a participant.
- A message may lead into a related tool interaction.

## Presentation

- Messages render from server-owned normalized rows.
- The product does not require React to infer authorship or model identity from raw runtime
  payloads.
- Mentions render as message fragments when the durable message metadata includes
  `metadata.tavern.mentions`.
- Mention metadata uses the exact message content as its coordinate space. Each mention stores a
  kind, runtime-facing id, display label, inserted text, runtime projection, and `start`/`end`
  string offsets.
- Tavern validates a mention before rendering it as a badge. If the offsets are missing,
  overlapping, out of bounds, or no longer match the inserted text, Tavern renders the affected
  content as normal plaintext.
- Mention badges are durable presentation hints. The message text remains readable without the
  metadata.
- Tavern Messenger may project skill mentions into the execution-only `bodyForAgent` as
  Codex-style skill context. Capability and path mentions stay as visible markdown. This does not
  change durable message text and does not grant access to tools or skills that the runtime would
  not otherwise expose.
