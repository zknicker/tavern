---
summary: Agent artifacts — durable self-contained HTML pages authored in the workspace, carded in chat, rendered in the artifact pane with host theme tokens.
read_when:
  - changing the artifact fence, its transcript card, the pane HTML preview, or host token injection
  - writing or reviewing agent guidance for authoring artifacts
  - deciding whether agent output belongs in chat (visual/widget) or the pane (artifact)
---

# Agent Artifacts

Agents build durable artifacts as self-contained single-file HTML pages: the
chat transcript shows a compact card, and opening it renders the page in the
artifact pane's sandboxed HTML preview. The agent authors one `.html` in its
workspace (inline CSS/JS, no external or sibling assets) and references it
with a bare `artifact` fence. Widgets and in-chat visuals cover
in-conversation data; artifacts are for visual or interactive outputs the
user will keep or iterate on, and big surfaces stay out of the chat column.

Maintained prose and reference material is not an HTML artifact. Agents write
that content to the shared Wiki and emit a bare `document` fence; the resulting
card opens the editable Wiki page in the same pane. Keeping `document` as a
sibling fence preserves the distinct storage and rendering contracts instead
of widening `artifact` into an ambiguous multi-target payload.

## Authoring contract

- One self-contained `.html`/`.htm` file under `workbench/`: inline CSS/JS
  only, no external or sibling asset references, no multi-file projects.
- Reference it with a bare `artifact` fence: `{"path": "workbench/...",
  "title"?: string}`. The chat shows a compact card; the pane owns sizing.
- Tavern theme tokens are injected into the page as CSS variables
  (`--background`, `--foreground`, `--surface-2`, `--border`,
  `--muted-foreground`, `--radius-lg`, ...) resolved for the current app
  scheme, so a token-styled page wears the Tavern look in light and dark.
  Pages should use the tokens with fallbacks and must not depend on any other
  host styling. The seeded `page-design` skill owns the authoring guidance —
  the full token vocabulary, layout discipline, and self-containment rules —
  and the always-on prompt entry only routes to it.
- Rendering is live file state — later edits or deletion change what the card
  opens, the same replay caveat as `html-preview`.

## Security boundary

Identical to `html-preview`: the confined Runtime workspace read (realpath
confinement to the sending agent's workspace, secret-file blocks, complete
reads only within the 5 MiB HTML window) fetches the file, and the document
renders via `srcDoc` in a sandboxed iframe with scripts allowed and never
`allow-same-origin`. Token injection inserts one `<style data-tavern-tokens>`
block of resolved variable values; no app data, bridge, or postMessage API
crosses the boundary.

## Card and pane flow

The `artifact` fence funnels into the widget machinery (component id
`tavern.widget.artifact`; see [widgets.md](widgets.md)). The transcript
renderer (`apps/website/src/widgets/artifact-card.tsx`) draws the compact
card — title, kind line, open affordance — and performs no workspace read.
Clicking calls the artifact-panel open path with a `workspaceFile` target,
the same merge-or-focus flow `grotto://workspace` links and the agent
`pane_open` tool use. In the pane, the workspace HTML preview
(`apps/website/src/features/chats/chat-artifact-workspace-preview.tsx`)
renders the page with host tokens injected
(`features/chats/host-token-style.ts`): the token allowlist is read off the
live document with `getComputedStyle` at render time and re-injected when the
app scheme flips. External-asset policy is self-contained-only; if a CDN
allowlist lands for in-chat visuals, artifact rendering should mirror it.
