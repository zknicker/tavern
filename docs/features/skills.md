---
summary: Skills & Plugins feature for reusable agent instructions, runtime plugins, secrets, usability, and agent access.
read_when:
  - changing skill inspection, plugin inspection, secrets, setup, runtime plugins, or agent access
  - changing how selected skills or plugins become available to the agent
---

# Skills & Plugins

The Skills & Plugins page is where users manage what the agent can do. It is a
combined view of all of the skills and plugins the agent has found and can use
from the sources supported by OpenClaw. Notably, this includes Codex harness
specific plugins like Computer Use.

## In the box

* **Skills.** Inspect reusable instruction packages the runtime can see,
  inspect their `skill.md`, configure declared secrets, and make them available
  to the agent.
* **Plugins.** Inspect runtime-backed capabilities and workflow packages from
  OpenClaw, Codex, and compatible plugin bundles.
* **Usability.** Show whether each skill or plugin is enabled and whether the
  runtime currently says the agent can use it.

## Contract

Skills teach the agent how to do work. Plugins extend the runtime with
capabilities the agent can use. Some plugins also ship skills, but a plugin is
not a skill row unless the runtime exposes it as a skill.

Tavern shows skills and plugins together because both answer "what can the
agent do?" Rows must still make the type clear.

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| OpenClaw skill folders | Skill | Includes workspace, project, personal, managed/local, bundled, and configured extra skill folders. |
| OpenClaw native plugin | Plugin | Native plugins can register tools, providers, channels, hooks, commands, services, and plugin-owned skills. |
| OpenClaw plugin bundle | Plugin | Codex, Claude, and Cursor-compatible plugin bundles are mapped into OpenClaw plugin capabilities. |
| Codex native plugin | Plugin | Exposed through the OpenClaw Codex harness when supported by Codex app-server and OpenClaw config. |
| Codex Computer Use | Plugin | Special Codex harness setup. OpenClaw prepares Codex app-server and verifies the `computer-use` MCP server before Codex-mode turns. |

Platform connections are separate. Discord, Slack, and similar messaging places
where an agent exists remain platform connections; their routing rules remain
bindings.

## Usability

Rows should stay simple:

| State | Meaning |
| --- | --- |
| Enabled | The user wants the agent to use it. |
| Disabled | The user does not want the agent to use it. |
| Not usable | The runtime reports that an enabled item is not currently available to the agent. |

Tavern should show runtime-provided reason text when it has it, but it should
not turn every setup, auth, dependency, reload, policy, or inventory edge case
into a separate product state.

## Runtime boundary

Tavern reads skill and plugin inventory from the runtime and stores the user's
access choices where Tavern has a supported config path.

Plugins stay owned by the runtime that exposes them. OpenClaw plugins may add
skills, workflows, tools, channels, or runtime behavior. Codex native plugins
remain Codex app-server capabilities surfaced through the OpenClaw Codex
harness. Tavern does not copy runtime skills or plugins into `~/.tavern/skills`
or describe plugins to the model as Tavern skills.

## What is intentionally missing

* Marketplace, install, uninstall, and update flows.
* Converting runtime plugins into Tavern skills.
* Expanded troubleshooting flows for unusable plugins.
