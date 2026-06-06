---
name: cortex-source-enrich
description: Turn raw source pages into structured, useful Cortex takeaways.
allowed-tools:
  - cortex_search
  - cortex_recall
  - cortex_get_page
  - cortex_list_backlinks
  - cortex_edit
  - cortex_capture
---

# Cortex Source Enrich

Use this skill when a source page, article, podcast, video, PDF, book,
transcript, screenshot, or repo import is present in Cortex but needs synthesis.

This is adapted from GBrain `article-enrichment`: raw dumps are not enough.
Cortex should preserve the source and also produce useful, recallable takeaways.

## Contract

This skill guarantees:

- Raw source content is preserved.
- The source is turned into a structured page with durable takeaways.
- Important claims, quotes, or timestamps remain traceable to the source.
- The page connects to existing Cortex context when that improves usefulness.
- No low-signal source is over-processed.

## When To Invoke

Use this skill for:

- "Enrich this article", "make this source useful", "extract takeaways", or
  "what should I remember from this?"
- Source pages created by `cortex-ingest`, `cortex-idea-ingest`, or
  `cortex-media-ingest`.
- Imported content that is a wall of text, transcript dump, OCR dump, or raw
  repo summary.
- High-value podcasts, books, articles, X posts, PDFs, videos, and screenshots.

Skip when the source is trivial, unreadable, duplicate, or already structured.

## Phases

1. Read the source page:
   - Use `cortex_get_page` for the exact slug or title.
   - Inspect compiled truth, body, source refs, links, and timeline entries.
   - Preserve existing raw content; do not discard it.
2. Check surrounding context:
   - Use `cortex_search` or `cortex_recall` for key people, companies, projects,
     products, niches, tools, topics, and user interests mentioned by the source.
   - Use backlinks when the source already participates in the graph.
3. Extract useful outputs:
   - Executive summary: the one thing worth remembering.
   - Why it matters: concrete connection to the user's work or interests.
   - Key takeaways: durable insights, not topic labels.
   - Quotable lines: verbatim only when the text is available.
   - Ideas to reuse: designs, automations, workflows, investment theses,
     content angles, product lessons, or decisions.
   - Open questions: what remains uncertain or worth checking.
4. Update the source page:
   - Use `cortex_edit action: "upsert"` with the existing title, slug, type, and
     structured body.
   - Keep source metadata and raw content references intact.
   - Add links only for durable relationships.
   - Add a timeline entry noting the enrichment pass when useful.
5. Capture standalone takeaways:
   - Use `cortex_capture` only for takeaways that should be recalled apart from
     the source page.
   - Prefer one focused capture for a durable thesis, idea, decision, or
     contradiction.
6. Report:
   - Summarize what became useful.
   - Mention any extraction limits, missing quotes, or uncertain claims.

## Suggested Page Shape

Use concise sections:

- `## Executive Summary`
- `## Why It Matters`
- `## Key Takeaways`
- `## Quotable Lines`
- `## Ideas To Reuse`
- `## Open Questions`
- `## Raw Source`

For long raw content, keep a short pointer to the preserved raw source file or
wrap the raw excerpt in a collapsible details block.

## Quality Bar

An enriched source is useful when it has:

- A direct summary.
- At least three concrete takeaways for substantial sources.
- A specific "why it matters" connection when Cortex context supports it.
- Source-traceable quotes or timestamps when available.
- Related Cortex page names or links for durable relationships.

## Anti-Patterns

- Paraphrasing quotes and presenting them as verbatim.
- Writing generic "why this matters" text with no Cortex grounding.
- Discarding the original raw source or source refs.
- Creating standalone pages for every mention.
- Re-enriching a page without checking whether it is already structured.
- Claiming unsupported facts from OCR or transcription without caveats.
