---
name: cortex-organize
description: Organize significant work into durable Cortex pages, links, takeaways, and follow-up actions.
allowed-tools:
  - cortex_search
  - cortex_recall
  - cortex_get_page
  - cortex_list_backlinks
  - cortex_capture
  - cortex_edit
  - cortex_ingest
  - cortex_import
---

# Cortex Organize

Use this skill after significant research, planning, implementation, ingestion,
or synthesis work that should not live only in chat.

This is adapted from GBrain `eiirp`: inventory what was produced, file it into
Cortex, keep sources traceable, and turn reusable patterns into durable context.

## Contract

This skill guarantees:

- Significant work is inventoried before writing.
- Durable knowledge lands in the right Cortex page or a clearly named new page.
- Source material remains traceable through source refs, URLs, files, or notes.
- Existing pages are updated instead of duplicated when possible.
- Reusable methods, decisions, and follow-ups are captured explicitly.

## When To Invoke

Use this skill when:

- The user says "organize this", "file all this", "make this re-doable",
  "archive this research", or "put this in Cortex".
- A work session produced research findings, source links, decisions, methods,
  workflows, scripts, docs, or implementation lessons.
- A source ingestion pass produced multiple durable takeaways.
- You notice a useful recurring pattern that should be remembered.

Do not use this for tiny one-off answers, transient execution logs, or chats
that produced no durable knowledge.

## Phases

1. Inventory outputs:
   - Primary findings.
   - Source URLs, PDFs, articles, posts, podcasts, screenshots, transcripts,
     repos, or files.
   - Entities: people, companies, products, projects, tools, niches, partners,
     platforms, and concepts.
   - Decisions, corrections, todos, automations, workflows, metrics, and open
     questions.
   - Reusable methods or patterns that should guide future work.
2. Build a filing plan:
   - Search Cortex for likely existing pages.
   - Reuse existing pages when the subject already exists.
   - Choose precise page types. If no existing type fits, use the clearer new
     type and let Runtime record the schema addition.
   - Prefer a small number of durable pages over many tiny pages.
3. Preserve sources:
   - Use `cortex_import` for source artifacts or locators that should be kept.
   - Use `cortex_ingest` for already-normalized source text.
   - Use `cortex_capture` for distilled durable facts, decisions, preferences,
     and reusable methods.
4. Update pages:
   - Use `cortex_edit action: "upsert"` to improve existing pages or create
     structured pages.
   - Add timeline entries for dated decisions, events, imports, and changes.
   - Add links for durable relationships.
   - Use merge/archive only when duplicate pages are clear.
5. Check quality:
   - Pages should have current truth first, source context, and useful links.
   - Corrections and contradictions should remain visible.
   - Raw material should not be confused with distilled truth.
6. Report:
   - List what was written or updated.
   - Mention skipped low-value items.
   - Name open questions or follow-ups.

## Filing Guidance

Common Cortex page types:

- `person`, `company`, `project`, `product`, `brand`
- `niche`, `listing`, `design`, `collection`, `marketplace`
- `production-partner`, `platform`, `tool`, `asset`
- `source`, `content`, `podcast`, `x-post`, `takeaway`
- `investment`, `trade`, `thesis`, `decision`
- `task`, `reminder`, `automation`, `workflow`
- `metric`, `fact`, `preference`, `idea`, `note`

Use `note` only when explicit save intent exists and no clearer type fits.

## Output Shape

Prefer a short manifest before writing when the session is large:

```markdown
## Cortex Organize Manifest
- Topic:
- Durable outputs:
- Source artifacts:
- Pages to update:
- Pages to create:
- Skipped:
- Follow-ups:
```

Then perform the writes and report the final page titles or slugs.

## Anti-Patterns

- Saving a broad chat dump instead of durable distilled knowledge.
- Creating duplicate pages before searching Cortex.
- Filing sources without reading or extracting content.
- Exploding one source into many weak pages.
- Hiding uncertainty or contradictions.
- Turning every method into a skill or page when it is unlikely to recur.
