# Chats

Chats are Tavern's shared conversation surfaces.

## Product Expectations

- Chats are the primary reading surface for real conversations.
- A chat should feel like one stable shared conversation, not a raw transport-specific fragment.
- A chat is the long-lived conversation container in Tavern.
- Multiple sessions may participate in one chat.
- A chat is not just one session, and it is not replaced when a session resets.
- New Tavern-owned chats should begin when a person sends the first message to the primary agent,
  rather than through a separate create-chat flow.
- The chats surface should read like a wall of live conversation columns rather than a thin list of
  transport records.

## Chat Loading And Handoffs

- Chat detail routes should keep the conversation shell and composer mounted while transcript data
  loads or routes reconcile. Do not replace the transcript body with loading copy or generic
  skeleton cards.
- Transcript loading should be indicated outside the transcript body, using the shared app spinner
  in the chat screen chrome.
- When transcript rows first arrive for a normal chat load, the divider and messages may enter with
  the standard `animate-float-up` treatment.
- When a new Tavern chat moves from the optimistic `/dashboard/chats/new` draft route to the real
  `/dashboard/chats/:chatId` route, rows already visible in the draft must not replay their entrance
  animation after reconciliation.
- Optimistic draft rows are app-local presentation state. They should be reconciled to the real chat
  route without becoming a separate durable transcript source.

## Config And Observation

- Tavern-owned chats are created, named, bound, ordered, renamed, and archived by Tavern App and
  Tavern Server.
- OpenClaw does not create, name, rename, archive, or delete Tavern-owned chats.
- Archiving a chat hides it from normal Tavern chat lists without deleting its chat row. Runtime
  session and message projections may continue to reference that stable chat id.
- OpenClaw may observe sessions and messages that belong to an Tavern chat. Those observations
  attach to the app-owned chat by session key and chat id.
- Runtime-observed external platform conversations, such as Discord channels or DMs, may still be
  projected as chats because the external platform owns those conversation containers.

## Identity And Labels

- A chat has a stable identity in Tavern.
- For Tavern-owned chats, the stable identity is the Tavern chat id and the label is Tavern-owned
  presentation metadata.
- For external runtime-observed chats, labels are Tavern presentation derived from synced primitive
  data.
- The OpenClaw adapter must not provide final Tavern chat names.
- The OpenClaw adapter must not project Tavern chats from OpenClaw sessions. Tavern sessions are
  runtime facts that attach to an existing Tavern chat; they are not a chat catalog.
- Direct chats should prefer participant names as their primary title.
- Channel-style chats should prefer the source-native room or thread name as their primary title.
- A synced chat should keep an explicit conversation kind so title and badge rendering do not rely
  on page-level heuristics.
- Runtime-projected direct chat records should expose primitive data such as `type`, `scope`, typed
  chat participants, bound agents, and observed display labels. The server should not hard-code
  final marketing-style titles when the frontend can derive them from those primitives.
- Platform-specific facts belong in typed `platformMetadata` on the chat projection. For example,
  a Discord chat can carry guild, channel, thread, DM user, account, observed label, and source
  record facts without making those fields part of every chat row.
- Runtime chat protocol records do not include chat `name` or chat `workspaceFolder`. Names are
  Tavern presentation, and runtime file browsing is agent-file scoped unless a runtime exposes a
  separate chat-file capability.
- For external direct messages, the external participant is a first-class chat primitive. Before
  the participant is linked to an Tavern profile, Tavern may render the best observed label. After
  linking, Tavern should render the profile presentation while retaining the participant as
  provenance.

## Relationships

- A chat should make it easy to understand which agent participated.
- A runtime-projected chat includes typed chat participants.
- A chat participant is either an agent or an observed external participant.
- The OpenClaw adapter owns platform-specific parsing before Tavern receives the chat. Tavern
  should not parse Discord-specific fields to understand chat membership.
- The primary agent participates in a chat through concrete sessions.
- Runtime projections may still include multiple bound agents when future product behavior needs
  them, but normal Tavern chat UI should not expose agent choice.
- A new session for the agent stays inside the same chat unless Tavern explicitly starts a
  different chat.
- A chat should make it easy to understand which non-agent participants were present.
- A chat should make it easy to move from the shared conversation to the related sessions when
  needed.
- A chat may contain message, tool, worker, and system interactions in one shared history.
