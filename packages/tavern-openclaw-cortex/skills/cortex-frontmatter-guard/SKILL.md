---
name: cortex-frontmatter-guard
description: Validate and repair Cortex page metadata, markdown structure, and schema-facing fields.
allowed-tools:
  - cortex_search
  - cortex_get_page
  - cortex_edit
---

# Cortex Frontmatter Guard

Use this skill when a Cortex page has malformed metadata, broken markdown
shape, invalid page type fields, stale aliases, or other structural issues.

This is adapted from GBrain `frontmatter-guard`. Tavern Cortex stores pages in
Runtime and projects managed markdown, so agents do not run GBrain's
`frontmatter` CLI. The skill guards the Cortex page contract through page reads
and `cortex_edit`.

## Contract

This skill guarantees:

- Page metadata is validated before structural repairs.
- Mechanical issues are fixed without changing meaning.
- Schema-facing fields use known or intentionally new Cortex types.
- Slugs, titles, aliases, source refs, links, and timeline entries remain
  consistent.
- Irreparable or ambiguous issues are reported instead of guessed.

## When To Invoke

Use this skill for:

- "Validate frontmatter", "check frontmatter", "fix frontmatter",
  "frontmatter audit", "Cortex lint", or "page metadata".
- A page has malformed markdown, broken metadata, duplicate aliases, bad links,
  wrong type, missing title, or a slug/title mismatch.
- A write failed because Cortex rejected page shape or schema fields.
- A page imported from source material looks structurally wrong.

Do not use this for citation quality; use `cortex-citation-fixer`.

## Validation Classes

Check for:

- Missing or unclear title.
- Slug/title mismatch.
- Invalid, overly broad, or accidental page type.
- Duplicate aliases or aliases that belong to another page.
- Broken wiki links or relationship links.
- Malformed timeline entries or date strings.
- Source refs without usable locator/title.
- Markdown sections that make current truth hard to identify.
- Null/binary corruption or obvious extraction artifacts.

## Phases

1. Read the page:
   - Use `cortex_search` for the title, alias, slug, or suspected duplicate.
   - Use `cortex_get_page` for the exact page before editing.
2. Audit structure:
   - Separate mechanical metadata issues from meaning changes.
   - Preserve user-authored text and source evidence.
   - If a type is missing, reuse the active Cortex schema when possible; use
     `cortex-schema` only when a clearer new type is warranted.
3. Repair:
   - Use `cortex_edit action: "upsert"` for mechanical fixes.
   - Keep current truth first.
   - Normalize aliases, links, timelines, and source refs without inventing
     missing evidence.
4. Report:
   - State what was fixed.
   - Name anything still needing human or source review.

## Anti-Patterns

- Using structural cleanup to rewrite the page's meaning.
- Silently changing a page type to a weaker catchall.
- Deleting old evidence because it is messy.
- Guessing missing titles, dates, URLs, or source ids.
- Treating this as a broad maintenance job when the user asked for one page.
