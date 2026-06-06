---
name: cortex-citation-fixer
description: Audit and repair weak or broken Cortex citations, source refs, and provenance.
allowed-tools:
  - cortex_search
  - cortex_get_page
  - cortex_list_backlinks
  - cortex_edit
  - cortex_capture
---

# Cortex Citation Fixer

Use this skill when Cortex pages have missing, weak, malformed, or broken
source references.

This is adapted from GBrain `citation-fixer`. Cortex does not require GBrain's
inline `[Source: ...]` markdown format; source refs, citations, claims, links,
and timeline entries are structured Runtime data. The goal is traceable
knowledge, not prettier citation syntax.

## Contract

This skill guarantees:

- Source-backed claims remain traceable to source refs, pages, URLs, files,
  messages, or timeline entries.
- Missing citations are flagged instead of invented.
- Broken post/article/media references are repaired only from deterministic
  source evidence.
- Page edits preserve current truth, old evidence, and contradictions.
- Results are reported with scanned, fixed, and unresolved counts.

## When To Invoke

Use this skill for:

- "Fix citations", "fix broken citations", "citation audit", or
  "check citations".
- A Cortex page has facts, quotes, timelines, or claims with no source context.
- A source URL, X post, article, PDF, podcast, screenshot, or file reference is
  missing, stale, or malformed.
- Enrich, organize, or ingest finds useful claims but weak provenance.

Do not use this to create new facts. Use it to repair evidence for facts already
present or newly sourced.

## Phases

1. Scope the audit:
   - For a named page, use `cortex_search` or `cortex_get_page`.
   - For a topic, search likely pages and inspect the most relevant matches.
   - For relationship claims, include backlinks when they may hold provenance.
2. Identify issues:
   - Claim, quote, or timeline entry without source refs.
   - Source ref missing URL, file id, title, date, author, or locator when the
     current context provides it.
   - Citation text that points to the wrong page, source, or claim.
   - Broken X/social post references without a real post URL.
   - Contradictions that were flattened into a single unsupported truth.
3. Repair only with evidence:
   - Reuse existing source refs, source pages, imports, files, timeline entries,
     backlinks, or current user-provided context.
   - If a current live lookup tool is available and the claim depends on a live
     source, verify before patching.
   - Never compose X/social URLs, article links, dates, or source titles from
     guesses.
4. Patch:
   - Use `cortex_edit action: "upsert"` to attach or correct source refs,
     timeline evidence, links, or body citations.
   - Use `cortex_capture` only for a new durable provenance note or correction
     that should stand alone.
   - Preserve uncited claims as unresolved if no evidence exists.
5. Report:
   - Pages scanned.
   - Issues fixed.
   - Remaining unsupported claims.
   - Any sources that need user input.

## Output Shape

```markdown
Citation audit
- Pages scanned:
- Issues fixed:
- Remaining gaps:
- Notes:
```

Keep the user report short unless they ask for the full audit.

## Anti-Patterns

- Inventing citations for facts with no source.
- Deleting uncited claims just to make an audit clean.
- Rewriting user-authored evidence into generic summaries.
- Guessing social post URLs or publication dates.
- Treating raw source dumps as compiled truth without source refs.
- Running a broad sweep when the user asked for one page.
