# Catalog

Tavern exposes a stable catalog of projected resources without requiring users to understand raw
OpenClaw records.

## Agents

Agents are OpenClaw-backed workers surfaced as first-class Tavern resources.

OpenClaw agent IDs are the canonical identities used for execution.

Tavern may keep local projection rows and presentation overlays so known agents stay readable when
OpenClaw is offline. Those projections do not replace OpenClaw-owned config.

## Chats

Chats are shared conversation surfaces that Tavern can display, read, and reuse.

Tavern may know about a chat from Tavern-owned configuration, OpenClaw-owned configuration, or
observed OpenClaw participation. The UI should present one coherent chat list whenever possible.

Chat labels are Tavern presentation derived from synced primitive data. For platform-backed chats,
the source facts live in typed chat platform metadata, such as Discord channel, thread, DM user,
guild, account, observed-label, and source-record facts.

## Agent Reachability

Tavern should show which chats an agent participates in when that relationship is known.

That view may be informed by runtime bindings, Tavern-owned overlays, and observed session
participation, but it should read as one coherent relationship.

## Models

Runtime owns the canonical model routing config used for execution.

Tavern may show a usable model catalog and editing UI without exposing a raw runtime config
structure.

## Runtime Observation

The catalog should render from local Tavern state without waiting on live runtime calls.

Observed runtime facts and runtime-owned config snapshots may refresh the catalog, but Tavern should
still present those resources in Tavern product language.
