---
summary: How to add or update an agent character avatar (AgentFace) — the two files to touch, the 480x480 frame contract, and theme/agent-color ink recoloring.
read_when:
  - adding a new agent character/avatar or updating an existing one's face art
  - changing AgentFace, head art, eye placement, or the agentCharacters contract
  - authoring 480x480 head SVGs for agents
---

# Agent Avatars

Agents render as a **character face** via `AgentFace`. Adding or changing a
character is a two-file change. The animated eyes drop into a fixed slot, so
there is no per-head fitting or transform math.

## The two files

- **Art** — `apps/website/src/features/chats/agent-face.tsx`: the SVG art
  constants and the `HEADS` registry.
- **Contract** — `packages/tavern-api/src/agent-appearance.ts`: `agentCharacters`
  (the id list) and `agentCharacterLabels`. This list is the single source of
  truth — it drives the Settings picker, persistence, Runtime validation, and
  default-avatar assignment. Every avatar surface reads from it automatically.

## Frame contract

- All art is authored in a **480x480** box. Eyes always render at `EYE_FRAME`
  (`{ dx: 0, dy: 24, s: 0.5 }`). Draw the head around that eye position; do not
  add per-head slots or transforms. `<AgentFace guide />` overlays the frame and
  resting eyes to check alignment while authoring.
- Each head ships **one art set** authored in the light scheme: white (`PAPER`)
  plus ink marks. Ink paths use `currentColor`, and `AgentFace` recolors them
  through its `ink` prop — light mode keeps the authored ink; dark mode passes
  the agent's configured color dropped to a low-contrast dark tone (see
  `resolveAgentInk` in `features/agents/agent-color-presets.ts`). White stays
  white in both themes. No separate dark art, no halo outlines.
- Exports may include **reference eyes** at the resting `EYE_FRAME` pose (the
  penguin exports do). Drop those paths when pasting — the animated eyes render
  at exactly that spot.

## Add a character

1. In `agent-face.tsx`, add one art group from the SVG — paste the `<path>`
   elements verbatim into `<g key="art">…</g>` (template-native art needs no
   transform; drop any `clipPath` wrapper and reference-eye paths). Name it
   `XYZ_ART`, fill whites with `PAPER`, and fill ink marks with `currentColor`.
2. Register in `HEADS`:
   ```tsx
   xyz: (_dark: boolean) => ({
     back: [XYZ_ART],
     front: [],
     // white/paper face → 'currentColor' eyes (follow the ink);
     // solid-ink face (cat) → PAPER eyes
     eyeColor: 'currentColor',
   }),
   ```
3. In `agent-appearance.ts`, add the id to `agentCharacters` and a label to
   `agentCharacterLabels`.
4. Verify: `bun run --filter @tavern/website typecheck` (TypeScript enforces that
   every `agentCharacters` id has a matching `HEADS` entry — this is the sync
   safety net), then `bun run lint`.

## Rendering a face

Call sites resolve the agent's appearance (character + configured color) via
`useAgentAppearanceLookup` (or the agent record's `effectiveCharacter` /
`effectivePrimaryColor`) and pass both theme and ink:

```tsx
<AgentFace dark={dark} head={character} ink={resolveAgentInk(dark, primaryColor)} … />
```

## Update an existing avatar

Replace that head's art constant in `agent-face.tsx`. No contract change.

## Notes

- Adding is additive — `character` is a stored string enum, so there is no
  migration. Renaming or removing a character orphans agents already set to it;
  prefer adding.
- Agent color names the agent everywhere **and** tints the face ink in dark
  mode. Light mode never tints.
- Two authoring styles live in `agent-face.tsx`: template-native (Figma 480
  export, pasted verbatim — penguin, robot) and Fable exports via `fableArt(...)`
  (a matrix transform — cat, dog, ghost, cloud, knight). Both share the same
  `currentColor` ink recoloring; new clean 480x480 SVGs use the template-native
  style.
