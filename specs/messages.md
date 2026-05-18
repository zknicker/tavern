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
- Inline tool mentions render as message fragments when the durable message metadata includes
  `metadata.tavern.toolMentions`.
- Tool mention metadata uses the exact plaintext message content as its coordinate space. Each
  mention stores a tool id, kind, display label, inserted text, and `start`/`end` string offsets.
- Tavern validates a mention before rendering it as a badge. If the offsets are missing,
  overlapping, out of bounds, or no longer match the inserted text, Tavern renders the affected
  content as normal plaintext.
- Tool mention badges are presentation hints. The message text remains readable without the
  metadata, and the agent prompt remains normal text.
