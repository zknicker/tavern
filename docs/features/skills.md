---
summary: Skills & Plugins feature for reusable agent instructions, runtime plugins, secrets, usability, and agent access.
read_when:
  - changing skill inspection, plugin inspection, secrets, setup, runtime plugins, or agent access
  - changing how runtime-visible skills or plugins become available to the agent
---

# Skills & Plugins

The Skills & Plugins settings page is where users manage what the agent can do. It is a
combined view of all of the skills and plugins the agent has found and can use
from user, workspace, managed, extra directory, and plugin sources. Tavern blocks
managed Hermes bundled skills from prompt eligibility because Runtime owns
that Hermes install.
Notably, this includes Codex harness specific plugins like Computer Use.

## In the box

* **Skills.** Inspect reusable instruction packages the runtime can see,
  inspect their `skill.md`, configure declared secrets, and see runtime
  readiness.
* **Plugins.** Inspect runtime-backed capabilities and workflow packages from
  Hermes, Codex, and compatible plugin bundles.
* **Catalog filters.** Switch between all visible items, skills, and plugins.
* **Readiness.** Show whether each skill or plugin is ready or needs setup,
  including runtime-provided blocker text.
* **Runtime surface.** Mark Codex-only capabilities so users know they are
  available through the Codex harness, not as Hermes prompt skills.

## Contract

Skills teach the agent how to do work. Plugins extend the runtime with
capabilities the agent can use. Some plugins also ship skills, but a plugin is
not a skill row unless the runtime exposes it as a skill.

Tavern shows skills and plugins together because both answer "what can the
agent do?" Rows must still make the type clear.

The page hides Tavern-owned infrastructure plugins such as Tavern Cortex and
Tavern Workspace. Runtime settings and capability health own those internals.

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Hermes skill folders | Skill | Includes the runtime-reported workspace, project, personal, managed/local, bundled, and configured extra skill folders. Managed Runtime config blocks bundled skill prompt eligibility with a sentinel `skills.allowBundled` allowlist. |
| Hermes native plugin | Plugin | Native plugins can register tools, providers, channels, hooks, commands, services, and plugin-owned skills. |
| Hermes plugin bundle | Plugin | Codex, Claude, and Cursor-compatible plugin bundles are mapped into Hermes plugin capabilities. |
| Codex native plugin | Plugin | Exposed through the Hermes Codex harness when supported by Codex app-server and Hermes config. |
| Codex Computer Use | Plugin | Special Codex harness setup. Hermes prepares Codex app-server and verifies the `computer-use` MCP server before Codex-mode turns. |

Platform connections are separate. Discord, Slack, and similar messaging places
where an agent exists remain platform connections; their routing rules remain
bindings.

## Usability

Rows should stay simple:

| State | Meaning |
| --- | --- |
| Ready | Runtime requirements are met. |
| Needs setup | The runtime reports missing tools, secrets, or config. |
| Checking | Runtime readiness is unknown. |

Tavern should show runtime-provided reason text when it has it, especially for
setup blockers such as missing binaries, environment values, or config paths.
It should not turn every setup, auth, dependency, reload, policy, or inventory
edge case into a separate product state.

## Runtime boundary

Tavern reads skill and plugin inventory from the runtime and stores plugin
access choices where Tavern has a supported config path.
Skill catalog reads use the latest stored Runtime inventory snapshot. Runtime
refreshes the snapshot on startup, every 15 minutes, and after skill-related
writes, then notifies the app when the stored inventory changes.

Managed Runtime config sets `skills.allowBundled` to a Tavern sentinel allowlist
with no real bundled skill ids. That keeps Hermes's bundled skill catalog out
of `<available_skills>` while preserving user, workspace, managed, extra
directory, and plugin-owned skills. The catalog hides skills Hermes reports as
blocked by runtime allowlist policy.

Plugins stay owned by the runtime that exposes them. Hermes plugins may add
skills, workflows, tools, channels, or runtime behavior. Codex native plugins
remain Codex app-server capabilities surfaced through the Hermes Codex
harness. Codex-only catalog rows must be labeled as Codex-only rather than
presented as Hermes skills. Tavern does not copy runtime skills or plugins
into `~/.tavern/skills` or describe plugins to the model as Tavern skills.

## What is intentionally missing

* Marketplace, install, uninstall, and update flows.
* Converting runtime plugins into Tavern skills.
* Expanded troubleshooting flows for unusable plugins.
