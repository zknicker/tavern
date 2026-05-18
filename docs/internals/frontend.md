---
summary: Frontend ownership rules for routes, features, components, hooks, lib helpers, and reusable UI promotion.
read_when:
  - changing React file layout, shared UI ownership, frontend hooks, or presentation helpers
  - moving reusable UI between route, feature, component, hook, or lib folders
---

# Frontend

The frontend is organized by ownership. Put reusable primitives where the
capability lives; keep route and feature folders for page assembly.

## Layout

| Area | Purpose |
| --- | --- |
| `routes/` | Thin route entrypoints |
| `features/` | Page and workflow composition |
| `components/` | Reusable UI owned by a capability |
| `hooks/` | App-level data and event hooks owned by a capability |
| `lib/` | Non-React formatting, view models, and adapters |

## Rules

* Promote shared chat, agent, memory, automation, or stats UI to the matching
  `components/<capability>` or `hooks/<capability>` folder.
* Keep feature folders for page-specific orchestration and local state.
* Avoid generic buckets such as `shared`, `common`, `helpers`, and `misc` when
  a clearer owner exists.
* Prefer short names scoped by folders over long prefixed filenames.

React conventions live in [react.md](react.md).
