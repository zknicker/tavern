# React

## Route Structure

- Keep route files thin.
- Let route and page boundaries own `Suspense`, skeletons, and error boundaries.
- Prefer route files that re-export or lightly wrap a feature entrypoint.

## Loading State Strategy

- Do not replace a primary content region with text like "Loading...". Keep the region's container
  mounted. Put the loading indicator in the closest header, toolbar, tab, or status surface.
- If the route itself is not ready, use the route skeleton. If only one data region is not ready,
  keep the rest of the route visible.
- Use skeletons only when they match the final component's size, alignment, and density. Do not use
  generic placeholder blocks for structured UI.
- Make entrance animation a prop or derived boolean when a component can render optimistic/cached
  content before server data arrives. Do not hard-code entrance animation in the leaf component.
- Add tests for fragile transition rules. At minimum, test the pure boolean that decides whether a
  reconciled server render should animate.

## Hooks

- Wrap tRPC React Query calls in hooks instead of calling tRPC directly from components.
- Keep hooks capability-first and narrow.
- Prefer domain hooks such as `use-session-log` or `use-models` over page-shaped aggregators.
- Colocate feature-only hooks with the feature. Promote domain hooks to `src/hooks/<domain>` as
  soon as ownership is clear.

## Components

- Keep files small and focused.
- Split large views into subcomponents when responsibilities diverge.
- Prefer composition through a few meaningful layers, not long chains of wrapper-only components.
- If a wrapper adds no reusable semantics, use local markup instead of another component.

## Props And State

- Pass small domain props or a local view model, not entire query objects or page-hook return
  types.
- Avoid prop drilling large state bags. Move logic closer to the consumer, split components by
  ownership, or use a focused context when state is truly shared.
- Do not type leaf components from `ReturnType<typeof usePageThing>`.

## Ownership

- Timeline and detail views belong to the page domain that owns them.
- Share only the primitives that are actually reusable: rows, badges, grouping helpers, formatting,
  and projection helpers.
