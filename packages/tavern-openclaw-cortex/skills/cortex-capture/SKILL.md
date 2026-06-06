---
name: cortex-capture
description: Save explicit durable thoughts, memories, corrections, and reusable context into Tavern Cortex.
allowed-tools:
  - cortex_search
  - cortex_get_page
  - cortex_capture
---

# Cortex Capture

Use this skill when the user explicitly asks to remember, save, capture, correct,
or keep durable information in Cortex.

## Contract

This skill guarantees:

- The user's explicit save intent is handled through `cortex_capture`.
- The saved page becomes immediately searchable and recallable through Cortex.
- Source context is preserved when available.
- Corrections update current truth without erasing older evidence.
- Secrets, broad chat dumps, and transient execution chatter are not captured.

## When To Invoke

Use this skill for:

- "Remember this", "save this", "capture this", or "put this in Cortex".
- A pasted thought, preference, decision, correction, or reusable project note.
- Research notes or call notes the user explicitly wants saved.
- A durable correction to an existing Cortex subject.

Do not use this skill for ambient memory capture. Cortex Chat Ingestion and
Cortex Dream handle background memory from chat history.

## Phases

1. Identify the durable content:
   - Preserve the user's wording when phrasing matters.
   - Extract the stable fact, preference, decision, correction, or reusable context.
   - Do not save secrets or sensitive material unless the user gives a clear reason.
2. Choose the page target:
   - For a known subject, use `cortex_search` or `cortex_get_page` first.
   - For a new durable subject, choose a specific title and page type.
   - If no subject page fits and the user explicitly asked to remember it, use `type: "note"`.
3. Preserve provenance:
   - Include source context in the capture call when available: chat id, message id, turn id, URL, file id, or actor.
   - Mention related Cortex page names or slugs in the content when useful.
   - State relationships plainly, such as "uses OpenRouter" or "contradicts the prior pricing assumption".
4. Capture:
   - Call `cortex_capture` with clear markdown content.
   - Use tags sparingly for durable grouping.
   - Prefer one focused capture over several tiny captures unless the user gave distinct facts.
5. Confirm briefly:
   - Tell the user what was saved.
   - Include the resulting page title or slug when the tool returns it.

## Defaults

- Type: `note` when no better page type fits.
- Title: clear, specific, and based on the saved subject.
- Content: concise markdown with the durable current truth first.
- Tags: optional; use only durable, useful labels.

## Corrections And Contradictions

When the user corrects Cortex:

- Search or read the existing subject page first when practical.
- Capture the corrected current truth.
- Mention what the correction supersedes or contradicts.
- Do not delete or hide older evidence just to make the page look clean.

## Anti-Patterns

- Capturing when the user did not ask to remember and future value is unclear.
- Saving broad chat logs instead of durable distilled content.
- Saving transient task progress, acknowledgements, or execution chatter.
- Capturing secrets as plain text.
- Creating multiple pages for one subject without checking for an existing page.
- Using capture for bulk ingestion, articles with metadata, or media workflows.

## When Not To Use

- Bulk files or many notes: use a dedicated ingest flow.
- Links, articles, tweets, or ideas with author/publication metadata: use a focused ingest skill.
- Current facts that must be live: check the source of truth instead.
