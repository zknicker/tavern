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

**Host adapter**:
A small integration file in Runtime, Server, or Website that connects a Rich Response contract to that
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
