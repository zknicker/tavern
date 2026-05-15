# Memory Lifecycle

Memory should not behave like one flat pool where a memory saved two minutes ago about the task at
hand has no retrieval advantage over a stale memory from last month.

Tavern should use distinct memory layers and distinct durable-memory tiers so the agent can both
stay oriented about what is happening now and recall what matters first.

## Relationship To Working Memory

Working memory and tiered durable memory solve different problems.

- `working memory` improves situational awareness by preserving what has happened recently.
- `tiered durable memory` improves recall quality by making the most relevant durable memories rank
  first.

Working memory tells the agent what is happening now. Tiered durable memory helps the agent find
what matters first when it searches long-term memory.

Working memory is for recent operational context. Tiered durable memory is for long-lived typed
memory with different retrieval and lifecycle behavior for hot memories and older memories.

## Tiered Durable Memory

Durable memory should use two tiers with distinct retrieval and lifecycle behavior.

The lifecycle contract therefore requires every durable memory to preserve:

- its current tier
- created and updated timestamps
- last meaningful access time
- demotion time when it moves from hot tier to graph tier

Without those fields, the tier rules cannot be enforced predictably.

### Hot Tier

The hot tier is for recently created or recently used durable memories.

- New durable memories should enter the hot tier by default.
- Identity memories should skip the hot tier and remain directly durable.
- Explicit long-term reference memories may also skip the hot tier and enter the graph tier
  directly.
- The hot tier should use a three-day default lifetime measured from last meaningful access, not
  from original creation.
- Accessing a hot-tier memory should refresh its hot lifetime.
- The hot tier should remain bounded, with a default size of 64 memories per agent.
- When the hot tier exceeds its intended size, the least-recently-used hot memories should demote
  early.
- Hot-tier memories should skip ordinary decay while they remain hot.

### Graph Tier

The graph tier is for older long-term durable memory.

- Memories should move into the graph tier when they fall out of active use or are evicted from the
  hot tier.
- The graph tier remains searchable and related, but it is not treated as currently active context.
- The graph tier should preserve relationships so recall can surface connected context rather than
  isolated rows.
- The graph tier should carry the normal long-term maintenance pipeline.
- The graph tier should use a thirty-day default retention window for memories that have become weak
  enough to prune.
- Identity memories should remain exempt from ordinary decay.

Memories that become relevant again should be able to return to the hot tier.

## Promotion And Demotion

Durable memory should move between tiers in predictable ways.

### On Creation

- New durable memories should begin in the hot tier by default.
- Identity memories should begin directly in the graph tier because they are already permanent.
- Explicit long-term reference memories may begin directly in the graph tier when the agent or user
  knows they are reference material rather than actively worked context.
- If the hot tier is already at capacity, Tavern should demote the least-recently-used hot memory
  before inserting the new hot memory.

### On Access

- When recall returns a hot-tier memory, Tavern should update that memory's last meaningful access
  so it remains hot while it is actively being used.
- When recall returns a graph-tier memory that becomes newly relevant to active work, Tavern should
  be able to re-promote it into the hot tier.
- When recall is person-specific, Tavern should start from profile or participant identity and then
  retrieve memories across manually linked observed participants.

### On Expiry

- Hot memories should demote into the graph tier when their hot lifetime expires.
- Demotion should preserve the memory, its provenance, and its relationships.
- Demotion should not require the memory to be rewritten as a new memory.

### On Capacity

- The hot tier should demote least-recently-used memories first when it exceeds its intended size.
- Capacity demotion should happen early enough that new hot memories always have room to enter.

## Recall Behavior

Tiered durable memory exists to improve recall quality.

- Hot-tier memories should be searched before graph-tier memories.
- Hot-tier memories should receive a retrieval boost in merged recall ranking.
- The default retrieval boost for hot-tier memories should be about 1.5x.
- Graph-tier memories should be searched after hot-tier memories using the full long-term memory
  recall behavior.
- Recall should deduplicate results before returning them.
- Recall should return the merged result set in relevance order rather than forcing the agent to
  manually filter tiers.
- Participant-scoped recall should include both participant-specific context and relevant shared
  context.
- Participant-scoped recall should key off profile or participant identity, not display name and
  not raw platform sender strings.

Tiered durable memory changes recall behavior. It does not mean every hot memory should be injected
into the prompt automatically. Prompt continuity should still come from working memory and the
bulletin.

## Maintenance

Hot-tier and graph-tier memories should follow different maintenance rules.

### Hot-Tier Maintenance

- Hot-tier memories should not decay while they remain hot.
- Hot-tier maintenance should focus on lifetime expiry and capacity enforcement.
- Hot-tier memories are usually too fresh to merge aggressively because they may still be evolving.

### Graph-Tier Maintenance

- Graph-tier memories should follow the normal long-term maintenance pipeline.
- Graph-tier maintenance should include decay, merge, and pruning.
- Weak graph-tier memories should become eligible for pruning after their retention window.
- For memories that passed through the hot tier, the long-term retention window should begin at
  demotion rather than original creation.
- For memories that entered the graph tier directly, the long-term retention window should begin at
  creation.

## Reflection And Forgetting

Tavern should periodically reflect over durable memory in the background so the memory set becomes
cleaner over time rather than noisier over time.

Reflection should:

- merge near-duplicate graph-tier memories
- strengthen canonical current memories
- reconcile updates and preserve contradictions
- mark old or conflicting memories appropriately

Forgetting should remain explicit and inspectable.

- Memories may be forgotten by supersession, expiry, completion, direct removal, or long-term
  pruning.
- Old memories should not silently pile up forever.
- When one memory replaces another, Tavern should preserve that relationship rather than pretending
  the older memory never existed.

## Bulletin And Prompt Continuity

Prompt continuity and recall quality are related but distinct concerns.

- Working memory exists to help the active session stay oriented about recent activity.
- Tiered durable memory exists to improve which long-term memories surface first during recall.
- The bulletin should remain the bounded prompt-facing continuity surface.
- The bulletin should not become a dumping ground for raw recall results.
- Hot-tier durable memory should influence recall priority without forcing per-turn prompt churn.

## Tavern Expectations

Tavern should provide this lifecycle as a built-in local capability rather than expecting users to
provision a separate memory service.

- Tavern should capture what is about to fall out of observed session context before compaction or
  session close makes that context less reliable when the runtime exposes enough signal.
- Durable memory extraction should run after capture as background work rather than on every normal
  turn.
- Tavern-owned background work should handle promotion, demotion, reflection, and forgetting without
  making memory availability a hard prerequisite for runtime execution.
