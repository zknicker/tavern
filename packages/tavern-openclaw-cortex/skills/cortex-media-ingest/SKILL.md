---
name: cortex-media-ingest
description: Ingest media, documents, transcripts, PDFs, books, screenshots, and repos into Tavern Cortex.
---

# Cortex Media Ingest

Use this skill when the user shares or asks to process a podcast, video, audio
file, transcript, PDF, book, screenshot, document, or repository.

This skill handles source-backed media only when text or structured content is
available from the user or from a current extraction tool.

## Contract

This skill guarantees:

- Media is reduced to bounded, inspectable text before Cortex writes.
- Source format, locator, title, creator, and extraction method are preserved.
- `cortex_import` stores the source artifact and normalized text.
- Durable takeaways are captured separately only when they are worth recalling.
- Missing OCR, transcription, captions, or file access is stated directly.

## Phases

1. Identify format and available extraction:
   - Podcast/audio/video: use transcript, captions, or an available transcription tool.
   - PDF/book/document: extract text or use the user-provided excerpt.
   - Screenshot/image: use OCR or vision only when available.
   - Repository: read the README and key files only when repo access is available.
2. Preserve provenance:
   - Record title, creator/author, format, URL or file id, date, page/chapter/range, transcript source, and extraction method.
   - Keep raw quotes or timestamps when they materially support the memory.
3. Check Cortex:
   - Search for known projects, people, companies, products, concepts, tickers, or source title.
   - Use prior pages to avoid duplicate pages and to connect the source to the user's context.
4. Ingest:
   - Call `cortex_import` with raw bytes when available, or with extracted text when the raw file is unavailable.
   - Use `cortex_ingest` only for already-normalized transcript/text with no raw artifact to preserve.
   - Use `kind: "podcast"`, `"video"`, `"document"`, `"book"`, `"repo"`, `"transcript"`, or `"source"` as appropriate.
   - Use `type: "podcast"` for podcast source pages and `type: "source"` or `"content"` for most other media.
5. Extract durable outputs:
   - Use `cortex_capture` for memorable quotes, reusable frameworks, design ideas, investment theses, automation ideas, or decisions.
   - Avoid turning every segment into a page; favor high-signal takeaways.
6. Report:
   - State what source text was ingested.
   - Summarize the useful takeaways and disclose unreadable or unavailable parts.

## Anti-Patterns

- Claiming a video, PDF, or repo was ingested when no text was extracted.
- Dumping transcripts without analysis.
- Ignoring timestamps, page ranges, source URLs, or file ids.
- Filing by media format when the durable subject is more important.
- Creating broad entity pages from incidental mentions.
