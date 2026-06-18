# Tavern

Tavern is a local agent workspace that renders durable chat, agent execution, and app-owned UI
from typed runtime contracts.

This file defines stable product language. It is not a docs index; run `bun run docs:list` to pick
the docs to read before changing behavior.

## Language

**Widget**:
A typed app-rendered UI block produced by an agent event and rendered by Tavern in chat or another
known product surface.
_Avoid_: UI block, widget kit, AG-UI component, ChatKit widget

**Widget activity**:
The durable response activity kind that stores a Widget render request in Tavern chat history.
_Avoid_: Custom activity with widget metadata, UI metadata row

**Widget tool**:
A narrow agent-facing tool that collects typed Widget intent and lets Runtime produce the
corresponding `ui.render` event.
_Avoid_: Raw JSON instruction, generic render-widget tool

**Widget definition**:
The package-shaped TypeScript module that owns one widget family's typed contract.
_Avoid_: Plugin, manifest package, runtime package

**Host adapter**:
A small integration file in Runtime, Server, or Website that connects a widget definition to that
layer's existing event, projection, or rendering pipeline.
_Avoid_: Widget implementation, plugin loader

**Surface component**:
A normal Tavern App React component used to render validated widget props with the app's shared
visual system.
_Avoid_: Model component, widget primitive

**Charts**:
The Widget family for agent-authored chart intent.
_Avoid_: Chart kit

**Widget component**:
A single renderable contract inside a Widget family, with its own component id and props schema.
_Avoid_: Widget, React component
