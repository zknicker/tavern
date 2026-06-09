---
summary: Skills & Toolsets feature for reusable agent instructions, Hermes tool groups, usability, and agent access.
read_when:
  - changing skill catalog, toolset catalog, setup blockers, runtime toolsets, or agent access
  - changing how runtime-visible skills or toolsets become available to the agent
---

# Skills & Toolsets

The Skills & Toolsets settings page is where users manage what the agent can use
from the runtime-managed Hermes instance.

## In the box

* **Skills.** View reusable instruction packages Hermes can see, enable or
  disable them for new Hermes sessions, and see runtime-reported setup blockers.
* **Toolsets.** Enable or disable Hermes tool groups such as browser, file, MCP,
  or provider-backed tools. Toolsets are not instructions; they are runtime tool
  access.
* **Catalog filters.** Switch between skills and toolsets.
* **Status.** Show whether each skill or toolset is enabled, off, needs setup,
  or unknown.

## Contract

Skills teach the agent how to do work. Toolsets grant access to groups of tools
Hermes can execute. Some plugins may provide tools or skills, but Tavern does not
show a separate plugin catalog here unless Hermes exposes a concrete skill or
toolset for it.

The page shows skills and toolsets together because both answer "what can the
agent do?" Rows must still make the type clear.

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Hermes skill folders | Skill | Includes runtime-reported workspace, project, personal, managed/local, and configured extra skill folders. Managed Runtime config blocks bundled skill prompt eligibility with a sentinel `skills.allowBundled` allowlist. |
| Hermes toolsets | Toolset | Runtime-owned groups returned by Hermes `/api/tools/toolsets`; enablement is sent back to Hermes. |
| Hermes plugins | Skill or toolset when exposed | Plugins can register tools, workflows, providers, and plugin-owned skills. Tavern shows the agent-facing skill or toolset, not the plugin package as a separate product row. |

Platform connections are separate. Discord, Slack, and similar messaging places
where an agent exists remain platform connections; their routing rules remain
bindings.

## Usability

Rows should stay simple:

| State | Meaning |
| --- | --- |
| Enabled | The item is enabled and Runtime reports no setup blockers. |
| Off | The skill or toolset is disabled for new sessions. |
| Needs setup | The runtime reports missing tools or config. |
| Unknown | Runtime setup status is unknown. |

Tavern should show runtime-provided reason text when it has it, especially for
setup blockers such as missing binaries, environment values, or config paths.
It should not turn every setup, auth, dependency, reload, policy, or inventory
edge case into a separate product state.

## Runtime Boundary

Tavern reads skill and toolset inventory from Runtime. Runtime reads skills from
its stored inventory snapshot and reads toolsets from managed Hermes.

Managed Runtime config sets `skills.allowBundled` to a Tavern sentinel allowlist
with no real bundled skill ids. That keeps Hermes's bundled skill catalog out of
`<available_skills>` while preserving user, workspace, managed, extra directory,
and plugin-owned skills. The catalog hides skills Hermes reports as blocked by
runtime allowlist policy.

Toolsets stay owned by Hermes. Tavern does not copy runtime tools or plugin
packages into `~/.tavern/skills`, and it does not describe toolsets to the model
as Tavern skills.

Runtime-owned workflow packages can still be prepared as managed skills when
they are part of Tavern's product contract. llm-wiki is the current example:
Runtime bundles the upstream workflow package as the `wiki` managed Hermes skill
so Tasks, crons, and normal agent turns can invoke wiki work.

Plugins stay owned by the runtime that exposes them. Hermes plugins may add
skills, workflows, tools, channels, or runtime behavior. Codex native plugins
remain Codex app-server capabilities surfaced through the Hermes Codex
harness. Codex-only catalog rows must be labeled as Codex-only rather than
presented as Hermes skills. Tavern does not copy runtime skills or plugins
into `~/.tavern/skills` or describe plugins to the model as Tavern skills.

## What is intentionally missing

* Marketplace, install, uninstall, and update flows.
* Converting runtime plugins or toolsets into Tavern skills.
* Expanded troubleshooting flows for unusable toolsets.
