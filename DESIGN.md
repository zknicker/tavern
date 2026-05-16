---
version: alpha
name: Tavern
description: Quiet desktop control-plane UI for agents, runtime state, memory, jobs, chats, and settings.
colors:
  background: "#ffffff"
  foreground: "#262626"
  chrome: "#fafafa"
  brand: "#1d4ed8"
  brand-foreground: "#eff6ff"
  card: "#ffffff"
  popover: "#ffffff"
  primary: "#262626"
  primary-foreground: "#fafafa"
  secondary: "#f5f5f5"
  secondary-foreground: "#262626"
  muted: "#f5f5f5"
  muted-foreground: "#525252"
  accent: "#f5f5f5"
  border: "#ebebeb"
  input: "#e6e6e6"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
  info: "#3b82f6"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  badge:
    fontFamily: "IBM Plex Mono, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.025em
  mono-meta:
    fontFamily: "IBM Plex Mono, SFMono-Regular, SF Mono, Consolas, Liberation Mono, monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 0.375rem
  md: 0.5rem
  lg: 0.625rem
  xl: 0.75rem
  2xl: 1rem
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  section: 2.5rem
components:
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
    padding: 0.75rem
  input:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
  select:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: 2rem
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
  settings-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    padding: 1.25rem
---

## Overview

Tavern is a dense, quiet desktop control-plane app. The interface should feel closer to Codex than
to a marketing dashboard: restrained, highly scannable, compact, and built for repeated use by an
operator who already understands the product.

The current visual north star is [`docs/assets/tavern-north-star-home.png`](docs/assets/tavern-north-star-home.png).
Use it as directional reference for the product feel: warm Tavern identity, agent activity as a
living operational scene, and dashboard information kept readable and actionable.

The design system source of truth is code, not this prose:

- Theme tokens live in `apps/website/src/styles/global.css`.
- Shared primitives live in `apps/website/src/components/ui`.
- Product-specific badge treatments live in `apps/website/src/components/badges`.
- The app uses COSS UI components backed by Base UI. Do not introduce shadcn or Radix primitives.

Prefer existing UI primitives exactly as they are. If a screen looks wrong, first improve the shared
primitive or global token that owns the issue. Only add local classes when the local layout genuinely
needs them.

## Colors

Use `apps/website/src/styles/global.css` tokens for all app colors. Do not hardcode ad hoc hex,
Tailwind palette classes, or opacity mixes in feature components unless the value is a product
brand color or provider badge treatment.

The token palette is neutral-first:

- `background`, `foreground`, `card`, `popover`, `border`, `muted`, `input`, and `secondary` carry
  most UI surfaces.
- `brand` is reserved for strong product emphasis, selected states, and primary actions.
- `success`, `warning`, `error`, and `info` are semantic status colors.
- `sidebar-*` tokens own navigation surfaces and should not be replicated in feature code.

Buttons, inputs, selects, badges, cards, tables, alerts, sidebars, and switches must consume
semantic tokens through the shared primitives. To change global color behavior, edit
`global.css` and the primitive together.

Avoid border-in-border compositions. When a control sits inside a card, prefer subtle filled
surfaces such as `bg-muted`, `bg-input`, or the primitive's default treatment over another strong
outline.

Provider and product badges may use special colors, but they should still be implemented as
specializations of `components/ui/badge.tsx` in `components/badges`.

## Typography

The app uses system sans for UI and IBM Plex Mono for compact metadata. The typography scale is
defined in `global.css`; `--app-ui-font-size` owns UI text and `--app-code-font-size` owns code
surfaces.

Use `text-sm` for normal app UI, labels, rows, buttons, and body text. Use `text-meta` for compact
metadata such as timestamps, durations, short row details, and secondary table cells. Use
`text-caption` or `text-micro` only for badges, ticks, and tiny labels. Avoid `text-xs` for ordinary
content; it usually makes dense settings screens feel inconsistent.

Badges use mono, uppercase, and slight positive tracking. This is a primitive-level decision in
`components/ui/badge.tsx`; do not recreate it with local classes.

Use short plain product language. Settings descriptions should usually be one line and disposable:
"Capture memories.", "Build knowledge.", "Maintain memory." If the description wraps or explains
the obvious, shorten it or remove it.

## Layout

Tavern screens should be operational, not editorial:

- Build the actual tool as the first screen, not a landing page.
- Use compact full-width sections with constrained inner content.
- Use `BadgeDivider` for section labels and separators.
- Leave more vertical space between settings sections than between rows inside a section.
- Keep settings rows aligned to a fixed value column so controls line up.
- Prefer dense lists and tables for status, logs, schedules, and repeated operational entities.

Settings pages should mostly use:

- `BadgeDivider`
- `SettingsGroup`
- `SettingsRow`
- COSS UI primitives from `components/ui`

Do not introduce page-local card-header mashups or custom row components when the shared settings
primitives are enough.

## Elevation & Depth

Use minimal depth. In light mode, cards generally should not have visible shadows; clean borders and
spacing are preferred. In dark mode, a very subtle shadow or inset highlight is acceptable when it
improves separation.

Tables and settings groups can sit inside subtle card surfaces when they are a contained tool, but
avoid nested cards. A control inside a card should look like a control, not like another card.

Use hover states that visibly change the surface. For muted controls, remember that alpha tokens
such as `secondary` may need to hover toward `input` or `accent` rather than `secondary/90`.
List rows and card-like buttons should change state immediately. Do not add transition classes to
basic hover, focus, or selected surface changes unless motion communicates a workflow transition.

## Shapes

Default interactive controls use modest radii:

- Buttons, inputs, selects, menus, and popovers use `rounded-lg`.
- Badges use `rounded-sm`.
- Cards use `rounded-xl` at most, with 8-12px radii depending on primitive defaults.
- Avoid pill shapes unless the primitive intentionally owns that style, such as a section badge.

Do not use decorative gradient orbs, bokeh blobs, or ornamental SVG backgrounds in app surfaces.

## Components

Start with `apps/website/src/components/ui` for every shared UI need. The most important primitives
are:

- `primitives/button.tsx`
- `primitives/input.tsx`
- `primitives/search-input.tsx`
- `select.tsx`
- `switch.tsx`
- `badge.tsx`
- `badge-divider.tsx`
- `settings-row.tsx`
- `card.tsx`
- `alert.tsx`
- `data-table.tsx`
- `code-snippet.tsx`
- `sidebar/*`
- `menu.tsx`, `dialog.tsx`, `popover.tsx`, `tooltip.tsx`

Use these primitives without modification at the call site whenever possible. Prefer component
props such as `size` and `variant` over local `className` overrides. If a primitive lacks a needed
variant, add it to the primitive so the system remains consistent.

Use `secondary` instead of `outline` for most app buttons. The interface already has many framed
surfaces; outline buttons often create extra visual noise.

Use `Alert` for callouts. Do not create page-local callout components for standard messages.

Use `CodeSnippet` for path-like or command-like values that need a gray code surface and copy
button. Do not hand-roll copy boxes.

Use HugeIcons for app icons, usually the solid rounded variant. Icons should generally inherit the
same color behavior as their text unless a provider or status treatment intentionally owns color.
Use `components/ui/spinner.tsx` for loading/running indicators; it owns the app-wide bare
`Loading03Icon` rotating treatment.

## Loading & Transitions

Do not render a bare text fallback such as "Loading transcript..." or "Loading details..." in place
of a primary content area. Keep the page shell, header, controls, and content viewport mounted while
data loads.

Use these loading treatments:

- Route or module has not mounted yet: render the route/module skeleton.
- Existing tool is switching records or refreshing one content region: keep that region's container
  mounted and show the shared spinner in nearby chrome.
- Repeated rows or cards are loading: use skeleton rows/cards only if their size, alignment, and
  density match the final rows/cards.
- Small framed status cell is loading: text such as "Loading..." is acceptable only when the final
  UI is also a short text value in the same spot.

Use `animate-float-up` only when new content appears for the first time. If optimistic, cached, or
previous-route content is already visible and the app is only reconciling it to server data, do not
run the entrance animation again.

Tables should be quiet:

- Sentence-case headers, never uppercase.
- Horizontal dividers only.
- Compact mono metadata for timestamps and durations.
- Short timestamps in rows, with full values in tooltips or titles when useful.
- Small status badges.

## Do's and Don'ts

Do:

- Use `global.css` tokens and Tailwind token names derived from them.
- Use COSS UI/Base UI primitives from `components/ui`.
- Change shared primitives when multiple screens need the same visual correction.
- Keep settings descriptions short enough to avoid wrapping.
- Prefer `text-sm` and `text-meta` over a mix of `text-xs` and `text-sm`.
- Use subtle filled controls inside cards to avoid border-in-border UI.
- Keep icons large enough to read and consistent with text color.
- Verify visual changes in both light and dark mode when they touch primitives or tokens.

Don't:

- Add new shadcn or Radix UI dependencies.
- Hardcode colors in feature components when a semantic token exists.
- Create one-off local controls instead of improving `components/ui`.
- Nest cards inside cards.
- Use strong shadows in light mode.
- Use outline buttons as the default secondary action style.
- Add long explanatory copy inside dense settings rows.
- Use uppercase table headings.
- Use `text-xs` for normal row content, settings copy, or table metadata.
- Add arbitrary font-size classes when a scale token would work.
