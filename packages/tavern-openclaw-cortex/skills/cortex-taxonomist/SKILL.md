---
name: cortex-taxonomist
description: Decide how Cortex knowledge should be filed, typed, titled, linked, or refiled.
allowed-tools:
  - cortex_search
  - cortex_recall
  - cortex_get_page
  - cortex_list_backlinks
  - cortex_capture
  - cortex_edit
---

# Cortex Taxonomist

Use this skill when new or existing Cortex knowledge needs the right page,
title, type, aliases, and durable relationships.

This is adapted from GBrain `brain-taxonomist`. Cortex does not file pages into
GBrain directory prefixes. The active Cortex schema and Runtime page graph are
the source of truth.

## Purpose

Prevent drift at write time:

- Reuse existing pages before creating new ones.
- Choose the page type that best describes the durable subject.
- Introduce clearer new page or link types only when useful.
- Refile or merge pages that no longer match their subject.

## Contract

This skill guarantees:

- The active Cortex schema and existing page graph drive the filing decision.
- The same content receives a reproducible page recommendation.
- Existing pages are updated instead of duplicated when they represent the same
  subject.
- Ambiguous cases surface options instead of silently choosing a weak fallback.
- Missing schema fit routes through `cortex-schema`.

## When To Invoke

Use this skill for:

- "Where does this Cortex page go", "file this in Cortex", "taxonomy check",
  "refile Cortex page", or "which page/type should this use".
- Creating a new Cortex page from non-trivial content.
- Bulk organize or ingest work where several pages may be created.
- A page appears to be the wrong type, duplicate, too broad, or split across
  multiple pages.
- The primary subject is ambiguous.

You do not need this skill for updating one clear existing page in place.

## Decision Protocol

1. Identify the primary subject:
   - Named person, organization, project, product, brand, niche, platform, tool,
     source, content, workflow, decision, task, reminder, idea, note, etc.
   - Use the user's wording when it signals the intended subject.
2. Check Cortex:
   - Search exact titles, aliases, handles, URLs, and likely slugs.
   - Use recall when the subject may be known by context.
   - Read likely pages before deciding duplicate vs new page.
   - Check backlinks when relationships define the subject.
3. Choose page target:
   - Update an existing page for the same durable subject.
   - Create a new page only when the subject is distinct and likely reusable.
   - Use the most precise existing page type that fits.
   - If no type fits, route through `cortex-schema` and use a lowercase
     kebab-case type.
4. Choose relationships:
   - Link only durable relationships, not incidental mentions.
   - Prefer clear verbs: `uses`, `depends_on`, `sourced_from`, `inspired_by`,
     `contradicts`, `mentions`, or a clearer schema-backed link type.
5. Validate:
   - Title is specific.
   - Type is meaningful.
   - Aliases are not stealing another page's identity.
   - Source refs and links are traceable.

## Output Shape

For advisory use:

```markdown
**Target:** <existing page or new title>
**Type:** <page type>
**Reasoning:**
- Primary subject:
- Existing page check:
- Relationships:
- Schema note:
```

For write workflows, apply the recommendation through the invoking skill and
keep the user report brief.

## Anti-Patterns

- Creating a page before searching Cortex.
- Filing by source format when the durable subject is more important.
- Picking `note` because the type decision is hard.
- Creating a synonym type for an existing type.
- Splitting one subject across many weak pages.
- Merging pages that only have similar names but different durable subjects.
