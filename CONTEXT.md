# Tavern

Tavern is a local agent workspace that renders durable chat, agent execution, and app-owned UI
from typed runtime contracts.

This file defines stable product language. It is not a docs index; run `bun run docs:list` to pick
the docs to read before changing behavior.

## Language

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
A first-party Tavern product capability for an external system, owning its configuration, status,
runtime actions, normalized view models, and any related Rich Response Components.
_Avoid_: Skill, connector, CLI dependency

**Plugin health**:
Runtime-owned readiness for a Plugin, including whether its required configuration and upstream
access are usable.
_Avoid_: Skill setup, tool availability, connection wizard state

**Plugin settings**:
Runtime-owned durable Plugin configuration, stored in dedicated Plugin tables and edited
through Tavern settings.
_Avoid_: Runtime metadata key, Hermes config, CLI config, skill config

**Plugin secret**:
Write-only credential material for a Plugin, stored in the Runtime Plugin secret store and
masked in API reads.
_Avoid_: Environment variable, Hermes home file, checked-in config

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
A Tavern-owned openable target such as a chat Artifact, Vault page, workspace file, image, or
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
A workspace file, Vault page, Markdown or HTML doc, image, or generated asset an agent created or
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

**Vault root**:
The user-owned Markdown directory that Vault reads and edits.
_Avoid_: Runtime Vault directory, managed storage, memory store

**Vault surface**:
The Tavern Runtime-owned access surface for the Vault root: path resolution, safe reads, writes,
freshness, and status.
_Avoid_: Wiki pipeline, ingestion system, maintenance job

**Charts**:
The Rich Response Component family for agent-authored chart displays.
_Avoid_: Chart kit

**Calendar displays**:
The Rich Response Component family for agent-authored calendar event and calendar day displays.
_Avoid_: Calendar widget tools
