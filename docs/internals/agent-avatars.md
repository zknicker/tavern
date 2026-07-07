---
summary: How to add or update an agent character avatar (AgentFace) — the two files to touch, the 480x480 frame contract, and current character registry.
read_when:
  - adding a new agent character/avatar or updating an existing one's face art
  - changing AgentFace, head art, eye placement, or the agentCharacters contract
  - authoring 480x480 head SVGs for agents
---

# Agent Avatars

Agents render as a **character face** via `AgentFace`. Adding or changing a
character is a two-file change. The animated eyes render inside a 480x480 face
frame and can be clipped or warped with the head art.

## The two files

- **Art** — `apps/website/src/features/chats/agent-face.tsx`: the SVG path
  constants, warp layers, and the `HEADS` registry.
- **Contract** — `packages/tavern-api/src/agent-appearance.ts`: `agentCharacters`
  (the id list) and `agentCharacterLabels`. This list is the single source of
  truth — it drives the Settings picker, persistence, Runtime validation, and
  default-avatar assignment. Every avatar surface reads from it automatically.

## Frame contract

- All art is authored in a **480x480** box. Eyes render at `EYE_FRAME`
  (`{ dx: -1.5, dy: 39.5, s: 0.7066 }`). `<AgentFace guide />` overlays the frame
  and resting eyes to check alignment while authoring.
- Current heads use `buildWarpLayers(...)` with path layers flattened once at
  module load, then warped each frame with the animated eyes. Use `front` layers
  for art that should occlude wandering eyes, such as beaks or mouths. Use
  `clip` to keep eyes inside a face window.
- `thirdEye: { dx, dy }` adds a live center eye at an eye-canvas offset from
  `(240, 240)`. Its pose is the L/R average, so it blinks and follows gaze with
  the pair (the alien's forehead eye).
- `eyeScale: { w, h }` restyles a head's eyes by scaling every emotion pose's
  width/height (radii saturate, so a squarer aspect reads rounder). The alien
  uses `{ w: 1.05, h: 0.62 }` — wide round eyes that leave its round white
  sockets showing all around, instead of the standard tall capsule.
- `AgentFace` still accepts `ink` for currentColor-backed marks, but current
  warp-layer characters mostly use authored fill colors.

## Add a character

1. In `agent-face.tsx`, add the SVG path constants for the head. Drop any
   reference-eye paths because animated eyes render from `EYE_FRAME`.
2. Register in `HEADS`:
   ```tsx
   xyz: (_dark: boolean) => ({
     back: [],
     front: [],
     warp: XYZ_WARP,
     eyeColor: "#070708",
     hlColor: "#fcfcfd",
   }),
   ```
3. In `agent-appearance.ts`, add the id to `agentCharacters` and a label to
   `agentCharacterLabels`.
4. Verify: `bun run --filter @tavern/website typecheck` (TypeScript enforces that
   every `agentCharacters` id has a matching `HEADS` entry — this is the sync
   safety net), then `bun run lint`.

## Rendering a face

Call sites resolve the agent's appearance via `useAgentAppearanceLookup` (or the
agent record's `effectiveCharacter` / `effectivePrimaryColor`) and pass both
theme and ink:

```tsx
<AgentFace dark={dark} head={character} ink={resolveAgentInk(dark, primaryColor)} … />
```

## Update an existing avatar

Replace that head's art constant in `agent-face.tsx`. No contract change.

## Notes

- Adding is additive — `character` is a stored string enum, so there is no
  migration. Renaming or removing a character orphans agents already set to it;
  prefer adding.
- Current characters are `knight`, `owl`, `bird`, `robot`, and `alien`.
