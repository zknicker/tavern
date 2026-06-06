---
name: cortex-ingest
description: Route source-backed content to the right Tavern Cortex ingestion path.
---

# Cortex Ingest

Use this skill when the user asks to ingest, process, save, or read source-backed
material into Cortex.

This is the router for ingestion. Use the most specific Cortex ingestion skill
when the input clearly matches one:

- Links, articles, X posts, newsletters, and raw ideas: `cortex-idea-ingest`.
- Podcasts, videos, PDFs, books, screenshots, documents, and repos:
  `cortex-media-ingest`.
- Explicit "remember this" or corrections without source metadata:
  `cortex-capture`.

## Contract

This skill guarantees:

- Source material is normalized before it is written.
- Ingested content keeps provenance: URL, file id, message id, source title, author, and date when available.
- Cortex receives artifacts through `cortex_import` and already-normalized text through `cortex_ingest`.
- Distilled durable facts are captured only when they are useful beyond the source page.
- Unsupported extraction is stated directly instead of fabricated.

## Phases

1. Classify the source:
   - Choose `cortex-idea-ingest` for links, articles, posts, and user ideas.
   - Choose `cortex-media-ingest` for documents, transcripts, podcasts, videos, screenshots, books, or repos.
   - Use this generic flow only when the content does not fit a narrower path.
2. Get bounded text:
   - Use available file, browser, fetch, OCR, transcript, or repo-reading tools when they exist.
   - If only a locator is available and no extraction tool can read it, ask for the text or file.
   - Do not save a blind bookmark as if it were ingested knowledge.
3. Normalize metadata:
   - Preserve title, author/creator, publication or platform, source URL, file id, created/published date, and format.
   - Keep the user's exact wording for original ideas, theses, and strong reactions.
4. Check Cortex before writing:
   - Use `cortex_search` or `cortex_recall` for known people, companies, projects, concepts, or prior coverage.
   - Prefer updating or linking to existing subjects over creating duplicate pages.
5. Ingest the source:
   - Call `cortex_import` for articles, posts, documents, PDFs, books, audio, video, podcasts, images, screenshots, or repos.
   - Call `cortex_ingest` with `kind`, `locator`, `title`, `content`, `metadata`, `tags`, and `type`.
   - Use `cortex_ingest` only when the source text has already been normalized and no raw artifact handling is needed.
   - Use `type: "source"` for preserved source pages unless a more precise page type fits.
6. Capture distilled knowledge only when warranted:
   - Use `cortex_capture` for a durable takeaway, decision, preference, fact, or user-authored idea that should stand on its own.
   - Do not explode one source into many pages unless the user asked for deep processing.
7. Report briefly:
   - State what was ingested.
   - Note any extraction gaps or skipped low-value writes.

## Anti-Patterns

- Treating a URL as ingested when no content was read.
- Saving raw source dumps without a useful title and metadata.
- Creating new pages before checking Cortex for existing coverage.
- Losing the user's exact wording for original thinking.
- Capturing every extracted detail instead of the durable few.
