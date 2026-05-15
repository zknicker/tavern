# Memories

Memories are Tavern's built-in system for long-term continuity.

They are not session logs, not chat history, not transcript archives, and not a manually curated
memory file. Session and chat history preserve what happened. Memory preserves what should keep
mattering.

Memory is a first-class Tavern capability. Users should not need to provision a separate memory
product for normal Tavern use. Memory should remain useful even when an individual extraction,
recall, or synthesis pass fails. A memory failure should not make the rest of Tavern unusable.

Memory is also not the same thing as a general knowledge base. Large document collections, research
libraries, and curated wikis are adjacent capabilities. Memory is the smaller set of things Tavern
should automatically keep in mind.

## Memory Model

Tavern memory has three layers with different jobs.

- `durable memory` stores long-lived typed memories that should survive across sessions.
- `working memory` stores recent operational context so the agent can stay oriented about what is
  happening now.
- `bulletin` is the bounded prompt-facing assembly of continuity context.

The bulletin is not the memory system itself. Durable memory and working memory are the underlying
memory system. The bulletin is the compact view Tavern presents to an active session.

## Durable Memory

Durable memory is stored as structured memory records, not as raw transcript chunks and not as a
single markdown file. Each durable memory preserves a clear statement of content, a type, an owner,
importance, recency, and provenance.

For person-level memory, `participant` is the canonical bridge. Platform senders such as Discord
accounts, Telegram accounts, or the Tavern app user should first resolve into a canonical
participant. Durable memories about that person should then attach to that participant identity, not
to a raw sender label or platform account string.

Durable memory should preserve:

- what the memory says
- what kind of memory it is
- who or what the memory belongs to
- for participant knowledge, who the memory is about and whose view it belongs to
- when it was created and last meaningfully used
- whether it is current, superseded, expired, completed, or otherwise inactive
- where it came from, such as a participant statement, an agent action, a system event, or an
  inference
- how it relates to nearby memories, such as updates, contradictions, causality, or general
  relevance

### Record Shape

Every durable memory should be a structured record, not just a blob of prose.

A durable memory record should preserve at least:

- a stable memory identity
- a clear ownership scope
- an optional subject when the memory is about a specific participant or entity
- an optional observation scope when the memory belongs to a specific point of view
- the memory type
- the memory content
- status such as `active`, `superseded`, `contradicted`, `completed`, `expired`, or `forgotten`
- importance
- lifecycle fields such as created time, updated time, last meaningful access, and current tier
- provenance such as source kind, source references, and the capture that created it
- searchable representation for recall

Durable memory should also support first-class associations between memories rather than hiding all
relationships inside prose alone. Update, contradiction, causality, and general relatedness should
remain inspectable relationships.

Durable memory should prefer one current canonical memory over many near-duplicate copies of the
same idea. When newer information replaces older information, Tavern should preserve that
relationship rather than pretending the older memory never existed.

Identity memories and explicitly permanent memories are foundational. They should be protected from
ordinary decay and pruning.

### Memory Types

Tavern durable memory uses explicit types.

- `fact`: Something treated as true. Facts capture stable project, user, or workspace information
  that may later be updated or contradicted by newer facts.
- `preference`: Something a person or agent tends to like, dislike, or consistently prefer.
  Preferences shape future behavior but usually change less often than ordinary conversation state.
- `decision`: A choice that has been made. Decisions preserve the chosen direction and the nearby
  context that explains why the choice matters.
- `identity`: Core information about who a participant, agent, workspace, or project is. Identity
  memories are especially durable and should remain easy to surface.
- `event`: Something that happened and still matters after the immediate moment passes. Event
  memories are temporal. Most ordinary recent activity belongs in working memory first, while only
  notable events should graduate into durable memory.
- `observation`: Something the system noticed or inferred rather than something explicitly stated.
  Observations are interpretive and should remain easier to revise than direct facts.
- `goal`: An outcome that is still being pursued. Goals describe direction and intent rather than
  the next concrete action.
- `task`: A concrete action item, reminder, or unit of work. Tasks should move cleanly between
  active, completed, cancelled, and obsolete states.

### Ownership

Every durable memory should have a clear owner in Tavern's domain model.

- Memory ownership should map to explicit product entities such as an agent, a workspace, or a
  participant.
- Person-level memory should use linked profile ownership when one exists and observed participant
  ownership otherwise.
- Source identities are how Tavern observes a person from external systems. They are not themselves
  the long-term owner of person knowledge.
- One profile may therefore accumulate memory from many manually linked observed participants over
  time.
- Tavern should support both shared memories and participant-specific memories.
- Shared project and agent knowledge should not be crowded out by one participant's personal
  context.
- Participant-specific memories must not leak into unrelated participants or unrelated agents.
- Participant observations and participant relationships should attach to profiles or observed
  participants, not to display names and not to raw platform sender strings.
- Memory should prefer explicit ownership over weak name-matching heuristics.

Ownership and subject are not always the same thing.

- The owner says whose durable memory space this belongs to.
- The subject says who or what the memory is about.
- For participant knowledge, the subject is often a participant while the owner remains the agent,
  workspace, or relevant shared memory scope.

### Person Memory Resolution

Tavern should resolve person-level memory through observed participants and manual profile links.

1. Observe a structured external source identity such as provider, account scope, external user ID,
   and display name.
2. Resolve that source identity to an observed participant.
3. Create a new participant only when no matching provider identity exists yet.
4. Store person-level durable memory against the linked profile when one exists; otherwise keep it
   against the observed participant.
5. Keep the observed participant as provenance and audit metadata.

This is what lets one Discord room contain many humans while still keeping each person's memory
separate. Manual profile links are what let one real person be connected across Tavern, Discord,
Telegram, and other surfaces without unsafe automatic merges.

## Product Surfaces

Tavern should expose memory as a readable product surface, not just as a hidden prompt feature.

- People should be able to inspect the current bulletin.
- People should be able to browse stored memories and understand what is active, stale,
  participant-specific, superseded, or forgotten.
- Memory views should favor readable lists and clear ownership over graph visualization as a
  primary experience.
- Memory should remain visible from synced local Tavern data even when the runtime is offline.

## Constraints

- Memory must not cause one agent's context to bleed into another agent.
- Memory must not cause one participant's private context to bleed into unrelated participants.
- Memory must stay bounded in prompt usage and must not steadily inflate every active session.
- Memory should prefer stable continuity over noisy freshness.
- Memory should preserve enough provenance that operators can understand what Tavern remembered and
  why.
