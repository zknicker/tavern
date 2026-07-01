# Tavern

Tavern is a local agent workspace that renders durable chat, agent execution, and app-owned UI
from typed runtime contracts.

This file defines stable product language. It is not a docs index; run `bun run docs:list` to pick
the docs to read before changing behavior.

## Language

**Chat**:
A durable Tavern conversation container, shaped like a channel or DM, where humans, agents, system
actors, and external actors can participate.
_Avoid_: Agent session, thread, executor channel, transcript

**Channel**:
A named multi-participant Chat in a Tavern workspace.
_Avoid_: Room, group chat

**DM**:
A one-to-one Chat between two participants.
_Avoid_: Private channel, direct channel

**Chat participant**:
One actor with membership in a Chat, such as a human user, Tavern agent, system actor, or external
identity.
_Avoid_: Worker, sender, runtime identity

**Agent seat**:
An agent Chat participant in a specific Chat, owning that agent's current session binding for the
Chat.
_Avoid_: Agent presence, session key, runtime route

**Agent session**:
The rotatable execution continuity record for an Agent seat.
_Avoid_: Chat, seat, runtime session

**Agent turn**:
One execution attempt by an Agent seat inside an Agent session.
_Avoid_: Agent run, Chat, session

**Active turn stream**:
Transient Runtime state for an in-progress Agent turn, used for live updates before durable Chat
messages and activity are complete.
_Avoid_: Chat history, UIMessage array, browser request

**Agent executor**:
A small Runtime implementation boundary that turns an Agent turn request into Tavern turn events.
_Avoid_: Agent engine, provider adapter, harness wrapper

**Agent addressing**:
The rule that decides which agent participants should create Agent turns for a Chat message.
_Avoid_: Session routing, runtime routing, trigger parsing

**Model provider**:
A Runtime integration that can expose agent-executable models after the user enables it and completes
its access setup.
_Avoid_: Model family, provider option, model row

**Provider catalog**:
The maintained list of Model providers Tavern can add to a Runtime.
_Avoid_: Executable model list, enabled providers, provider credentials

**Enabled model provider**:
A Model provider the user has added to the Runtime. It may still need credentials, OAuth, CLI setup,
or host dependencies before it can execute turns.
_Avoid_: Connected provider, catalog provider, installed provider

**Provider access**:
The credential and host setup state for an Enabled model provider.
_Avoid_: Model capability, provider config, agent model

**Executable provider**:
An Enabled model provider whose Provider access is ready for Agent turns on the Runtime host.
_Avoid_: Catalog provider, connected provider, authenticated provider

**Model record**:
A catalog row for a concrete model route, including its model ref, display metadata, capabilities,
provider, and execution kind. A Model record is executable only when it belongs to an Executable
provider.
_Avoid_: Model alias, provider option, model family

**Executable model**:
A Model record that belongs to an Executable provider and can be used for Agent turns now.
_Avoid_: Available model, configured model, default model

**Agent runtime profile**:
An agent's selected Model record plus execution policies for tools, memory, and sandboxing.
_Avoid_: Provider config, harness config, model config

**Agent default model**:
The Model record stored on an Agent runtime profile and used when Runtime creates a new Agent
session.
_Avoid_: Global model, provider default, app default

**Effective model**:
The Model record an Agent session currently uses. Agent runtime profiles provide defaults, but
current model selection is session-scoped.
_Avoid_: Global agent model, provider setting

**Tool**:
A Runtime-visible executable action an agent may invoke during an Agent turn.
_Avoid_: Skill, MCP server, channel, Plugin

**Harness-native tool**:
A Tool supplied by the selected Agent executor's harness, such as local file, shell, search, or
provider-native subagent actions. Tavern may display these as provider facts, but does not own their
individual lifecycle.
_Avoid_: Tavern tool, Plugin action, MCP server

**Tavern host tool**:
A Tool implemented by Tavern Runtime and passed to the Agent executor, such as Memory reads, Plugin
actions, Rich Response creation, or other Tavern-owned product actions.
_Avoid_: Harness-native tool, raw Runtime route, Plugin setting

**MCP server**:
A Runtime-owned connection record for an external Model Context Protocol server, including
transport, secrets, enablement, health, and the tools or resources it exposes to eligible agents.
MCP servers are advanced Runtime plumbing in v1; Tavern's normal user-facing integration surface is
Plugins.
_Avoid_: Tool, Plugin, Channel

**MCP grant**:
An internal or advanced agent-level policy that allows an agent to use one Runtime-enabled MCP
server during Agent turns. V1 product surfaces should prefer Plugin grants.
_Avoid_: MCP server enablement, per-chat MCP setting, Plugin grant

**Plugin grant**:
An agent-level policy that allows an agent to use one enabled built-in Tavern Plugin's agent-facing
tools.
_Avoid_: Plugin enablement, Plugin setting, Plugin health, user-installed tool package

**Sandbox mode**:
The execution environment for an agent's tools and harness processes: none, Docker, or Podman.
_Avoid_: Approval mode, runtime prompt

**Local workspace sandbox**:
A Sandbox mode of none where Tavern gives an agent a host filesystem workspace under the Tavern data
root and runs child processes directly from that workspace.
_Avoid_: Secure sandbox, container, VM

**Assignable primitive**:
A Tavern capability that can be attached to an agent definition, such as a Skill, Plugin, Memory
namespace, or Channel membership.
_Avoid_: Runtime plugin, harness setting, bundled feature

**Installed skill**:
A reusable instruction package available in Tavern for assignment to agents.
_Avoid_: Assigned skill, enabled tool, marketplace item

**Skill assignment**:
An agent setting that references installed skills the agent should receive during turns.
_Avoid_: Skill install, skill discovery, global enablement

**Rich Response**:
One assistant-authored, app-rendered UI island attached to an assistant response.
_Avoid_: Widget, UI block, widget kit, AG-UI component, ChatKit widget

**Rich Response activity**:
The durable response activity kind that stores a Rich Response in Tavern chat history.
_Avoid_: Widget activity, custom activity with UI metadata

**Rich Response Spec**:
The validated json-render document that describes a Rich Response's state, layout, and catalog
components.
_Avoid_: Raw JSON, HTML, JSX, component tree

**Rich Response Catalog**:
The Tavern-owned vocabulary of components and prop schemas an agent may use inside a Rich Response.
_Avoid_: Plugin registry, arbitrary component set, model component library

**Rich Response Component**:
A single allowed component in the Rich Response Catalog, rendered by Tavern from validated props.
_Avoid_: React component, model component, widget tool

**Plugin**:
A built-in Tavern product capability for an external system, owning its configuration, status,
runtime actions, normalized view models, and any related Rich Response Components. In v1, Tavern
does not support user-installed Plugins; user-provided executable integrations belong behind MCP
servers.
_Avoid_: Skill, connector, CLI dependency, user-installed package

**Plugin health**:
Runtime-owned readiness for a Plugin, including whether its required configuration and upstream
access are usable.
_Avoid_: Skill setup, tool availability, connection wizard state

**Plugin settings**:
Runtime-owned durable Plugin configuration, stored in dedicated Plugin tables and edited
through Tavern settings.
_Avoid_: Runtime metadata key, executor config, CLI config, skill config

**Plugin secret**:
Write-only credential material for a Plugin, stored in the Runtime Plugin secret store and
masked in API reads.
_Avoid_: Environment variable, executor home file, checked-in config

**Plugin action**:
A Runtime-owned operation exposed by a Plugin to Tavern surfaces such as Rich Responses,
agent tools, or settings.
_Avoid_: CLI command, skill tool, raw upstream API call

**Artifact**:
A durable Runtime-owned output that can be rendered, reopened, and referenced from chat.
_Avoid_: Preview, attachment, tool result, generated file

**Artifact Panel**:
The app-owned side surface where users open and inspect Artifact Panel targets beside chat.
_Avoid_: Workbench, browser shell, output pane, Artifact Space

**Artifact Panel target**:
A Tavern-owned openable target such as a chat Artifact, Memory file, workspace file, image, or
generated asset.
_Avoid_: Local path, browser URL, tool result blob

**Artifact pane**:
One open view inside the Artifact Panel, backed by one Artifact Panel target.
_Avoid_: Tab content, preview card, drawer

**Artifact open action**:
A user action that opens an Artifact pane from a chat row, activity row, or linked inspectable
output. Tavern does not auto-open the Artifact Panel when targets are created.
_Avoid_: Canvas trigger, automatic artifact presentation, artifact launch

**Inspectable output**:
A workspace file, Memory file, Markdown or HTML doc, image, or generated asset an agent created or
updated for the user to inspect.
_Avoid_: Tavern resource, tool result, attachment

**Host adapter**:
A small adapter file in Runtime, Server, or Website that connects a Rich Response contract to that
layer's existing event, projection, or rendering pipeline.
_Avoid_: Rich Response implementation, plugin loader

**Surface component**:
A normal Tavern App React component used to render validated rich-response props with the app's shared
visual system.
_Avoid_: Model component, widget primitive

**Memory root**:
The user-owned Markdown directory that Memory reads and edits.
_Avoid_: Runtime storage root, managed workspace, workbench

**Memory surface**:
The Tavern Runtime-owned access surface for the Memory root: path resolution, safe reads, writes,
freshness, and status.
_Avoid_: ingestion system, maintenance job

**Charts**:
The Rich Response Component family for agent-authored chart displays.
_Avoid_: Chart kit

**Calendar displays**:
The Rich Response Component family for agent-authored calendar event and calendar day displays.
_Avoid_: Calendar widget tools
