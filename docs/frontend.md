# Frontend

Tavern organizes frontend code by ownership, not by call-site count. The same ownership rule
applies in the app backend, but the concrete layout lives in `docs/app.md`.

## Top-Level Areas

- `components/`
  Reusable UI primitives owned by a domain or platform capability.
- `hooks/`
  Platform-level React hooks owned by a domain or platform capability, even with one consumer.
- `features/`
  Page and workflow composition. Keep feature folders focused on route-specific assembly.
- `lib/`
  Non-React helpers, projections, formatting, and adapters.
- `routes/`
  Thin route entrypoints only.

## Ownership Rules

- Promote code to `components/<domain>` or `hooks/<domain>` as soon as it represents a product or
  platform concept.
- Keep `features/<surface>` for page-specific composition, local state, and workflow-only views.
- Put shared UI primitives in domain folders, not in feature folders and not in generic `shared`
  buckets.
- Prefer `components/chats/discord-badge.tsx` over feature-local duplicates.
- Prefer `hooks/sessions/use-session-log.ts` over long prefixed filenames in a flat hooks folder.

## Page Ownership

- Each page owns its own detail and timeline views when the requirements differ.
- Shared code should be the projection helper or UI primitive, not a fake cross-product feature.
- Avoid top-level frontend areas like `features/activity`. A session timeline belongs to
  `sessions`, a job run timeline belongs to `jobs`, and so on.

## Directory Shape

Use folders to carry scope so filenames can stay short.

- Good:
  `hooks/sessions/use-session-log.ts`
- Good:
  `components/jobs/job-state-badge.tsx`
- Good:
  `features/settings/connections/page.tsx`
- Good:
  `features/settings/connections/model-access-section.tsx`
- Good:
  `hooks/sync/agents/use-events.ts`
- Good:
- Bad:
  `use-runtime-session-message-log.ts`
- Bad:
  `components/shared/shared-chat-discord-badge.tsx`

## Shared Buckets

Avoid long-term generic buckets such as:

- `shared`
- `common`
- `helpers`
- `misc`

Only use them when the code genuinely has no clearer owner. In most cases, there is a better owner.
