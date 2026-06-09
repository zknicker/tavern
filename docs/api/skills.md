---
summary: Skills & Toolsets API for skill catalog reads, skill enablement, runtime toolset enablement, and setup blocker metadata.
read_when:
  - changing skill catalog, setup blocker, runtime toolset, or agent access APIs
  - changing how clients list reusable runtime abilities and runtime tool access
---

# Skills & Toolsets API

The Skills & Toolsets API backs the Skills & Toolsets settings page. It exposes
the runtime-visible instruction packages and tool groups configured in the
managed Hermes instance.

Skills are runtime instruction packages with setup blocker metadata and
enablement state.

Toolsets are Hermes-owned groups of tools. They control which runtime tool
groups are enabled for new sessions. A toolset is not a skill row unless Hermes
also exposes a concrete skill for it.

## Contract

* Skill ids are stable within the runtime source.
* Setup requirements and source state are visible.
* A skill can be visible while Runtime reports setup blockers.
* Toolset ids are stable Hermes toolset names.
* Toolset enablement separates the user's choice from whether Hermes reports the
  toolset as configured and usable.
* Runtime toolset details are exposed as metadata for diagnostics, not as copied
  Tavern skill instructions.

## Surface

The API covers:

* list visible skills
* enable or disable runtime-managed Hermes skills
* read setup requirements
* list Hermes toolsets visible to Tavern
* enable or disable a Hermes toolset
* read runtime-provided usability and diagnostic text

## Runtime Boundary

Hermes owns skill discovery, toolset discovery, eligibility, dependency checks,
prompt loading, and execution.

Skill list reads return the latest Runtime SQLite skill inventory snapshot.
Runtime refreshes that snapshot on startup, every 15 minutes, and after
skill-related writes. The refresh job emits the skill update event only when the
stored inventory changes, so the app can refetch without blocking settings
navigation on live Hermes discovery.

Managed Hermes bundled skills stay available to Hermes itself, but Tavern
configures `skills.allowBundled` to a Tavern sentinel allowlist with no real
bundled skill ids, so bundled skills are not eligible for agent prompt
injection. The Skills & Toolsets API hides skills Hermes reports as blocked by
runtime allowlist policy.

Toolsets remain Hermes-owned. Tavern reads them from Hermes and sends supported
enablement changes back through Runtime. Codex app-server skills are not merged
into the Tavern skill catalog.

## Related Docs

* [Skills & Toolsets feature](../features/skills.md)
* [Agents API](agents.md)
* [API overview](overview.md)
