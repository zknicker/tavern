---
summary: Artifact Pane UI notes for chat-scoped inspectable outputs, tabs, renderers, and linked Memory/workspace targets.
read_when:
  - changing Artifact Pane UI, inspectable output links, chat artifact tabs, or linked Memory/workspace renderers
---

# Artifact Pane UI Notes

## Current Direction

The artifact pane should feel like a compact assistant workspace attached to the chat, not a full browser. It opens when the user clicks a linked output such as a Memory page, Markdown file, HTML preview, image, or generated asset.

## Chrome

- Tabs sit in the top row.
- The selected tab uses a soft rounded pill.
- Inactive tabs stay low-contrast.
- One close button closes the pane.
- A plus icon can suggest that more artifacts arrive from chat links, but it should not look like a primary action.

## Behaviors

- Clicking the same link focuses the existing tab.
- Clicking a new link opens a new tab and selects it.
- Tabs are scoped to the active chat.
- Switching chats clears the pane.
- The pane opens manually only. No auto-open heuristics yet.

## Renderers

| Input | Renderer |
| --- | --- |
| `.md` / `text/markdown` | Markdown preview |
| `.html` / `text/html` | Sandboxed preview |
| `.png`, `.jpg`, `.webp`, `.gif` | Image preview |
| Unknown type | Unsupported state |

## Visual Targets

The pane should borrow the useful parts of Codex, Claude, and OpenCode:

- tabbed artifact switching
- quiet top chrome
- clear file title and source path
- enough width for reading Markdown comfortably
- no browser controls until we actually support browser behavior

## Open Questions

- Should every tab eventually get its own close affordance?
- Should images use zoom/pan controls in the first version?
- Should HTML previews support an address/source bar, or just a title row?
- Should workspace files and Memory pages share one link scheme, or stay visibly distinct?

## Sample Agent Reply

I wrote the output here:

- [Panel Brief](tavern://memory/Demos/Panel%20Brief.md)
- [Preview HTML](tavern://workspace/out/preview.html)
- [Generated Chart](tavern://workspace/out/chart.png)

The user should be able to click the thing itself and inspect it in the artifact pane.
