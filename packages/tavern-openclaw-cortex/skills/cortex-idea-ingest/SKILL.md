---
name: cortex-idea-ingest
description: Ingest links, articles, X posts, newsletters, and user ideas into Tavern Cortex.
---

# Cortex Idea Ingest

Use this skill when the user shares a link, article, X post, newsletter, or idea,
or says "read this", "think about this", "save this", or "put this in Cortex".

The user does not need to say "remember this" when they share a meaningful
source. Treat the share as a signal to consider ingestion, then apply the
quality bar.

## Contract

This skill guarantees:

- Shared source content is read when a current tool can read it.
- Author, publication, platform, URL, and date are preserved when available.
- The source is written through `cortex_import` or `cortex_ingest`, not blind capture.
- Analysis connects the source to existing Cortex context when useful.
- User-authored ideas preserve the user's exact phrasing.

## Phases

1. Read the source:
   - For articles, newsletters, and posts, fetch or read the full text when a tool is available.
   - For X posts or threads, keep the post text, handle, timestamp, URL, and image text when available.
   - If extraction is not available, ask for the text or save only the user-provided excerpt.
2. Identify source metadata:
   - Title, author, handle, publication, platform, published date, URL, and related entities.
   - Use `kind: "article"` for articles/newsletters, `kind: "x-post"` for X/social posts, and `kind: "idea"` for user-authored thoughts.
3. Check Cortex:
   - Search for the author, source title, subject, and major mentioned entities.
   - Use prior context to avoid duplicate pages and to spot connections or contradictions.
4. Ingest:
   - Call `cortex_import` when the article, post, raw body, or fetched content should be preserved.
   - Call `cortex_ingest` only when normalized source text is already available and raw preservation is unnecessary.
   - Use `type: "source"` for article/post pages, `type: "x-post"` for standalone social posts, and `type: "idea"` for user-authored ideas.
5. Distill only useful knowledge:
   - Use `cortex_capture` for a durable takeaway, thesis, preference, content idea, or contradiction that should be recalled apart from the source.
   - Do not create an author page or entity page unless there is enough durable value to track it.
6. Respond with analysis:
   - Give the user the useful takeaways, not just a summary.
   - Mention what was saved and any extraction limits.

## Quality Bar

Ingest when the item is likely to matter again because it relates to the user's
businesses, investing, design, programming, automations, active projects,
recurring interests, or original thinking.

Skip or ask before writing when the source is casual, ephemeral, unreadable, or
only loosely relevant.

## Anti-Patterns

- Filing every link as a source without reading it.
- Summarizing without connecting to Cortex context.
- Saving an author or entity page just because a name appeared once.
- Paraphrasing the user's own idea when exact wording matters.
- Ignoring contradictions with existing Cortex knowledge.
