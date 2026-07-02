---
summary: How to add or update an agent character avatar (AgentFace) — the two files to touch, the 480x480 frame contract, and light/dark art variants.
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
- Each head ships two variants: the **standard** art (light mode) and a **halo**
  variant (dark mode — a paper ring so a light body separates from a near-black
  background). Provide both as 480x480 SVGs; the caller passes `dark` and
  `AgentFace` picks the variant.

## Add a character

1. In `agent-face.tsx`, add two art groups from the SVGs — paste the `<path>`
   elements verbatim into `<g key="art">…</g>` (template-native art needs no
   transform). Name them `XYZ_ART` (light) and `XYZ_ART_HALO` (dark), and use
   `PAPER` / `INK` for fills so they stay tokenized.
2. Register in `HEADS`:
   ```tsx
   xyz: (dark: boolean) => ({
     back: [dark ? XYZ_ART_HALO : XYZ_ART],
     front: [],
     eyeColor: DARKEYE, // white/paper face → DARKEYE; solid-dark face (cat) → PAPER
   }),
   ```
3. In `agent-appearance.ts`, add the id to `agentCharacters` and a label to
   `agentCharacterLabels`.
4. Verify: `bun run --filter @tavern/website typecheck` (TypeScript enforces that
   every `agentCharacters` id has a matching `HEADS` entry — this is the sync
   safety net), then `bun run lint`.

## Update an existing avatar

Replace that head's two art constants in `agent-face.tsx`. No contract change.

## Notes

- Adding is additive — `character` is a stored string enum, so there is no
  migration. Renaming or removing a character orphans agents already set to it;
  prefer adding.
- Agent color is a name label only; it never tints the avatar. Eye color is
  chosen per head (`eyeColor`), not from agent color.
- Two authoring styles live in `agent-face.tsx`: template-native (Figma 480
  export, pasted verbatim — penguin, robot) and Fable exports via `fableArt(...)`
  (a matrix transform with an auto-generated halo — cat, dog, ghost, cloud,
  knight). New clean 480x480 SVGs use the template-native style.
