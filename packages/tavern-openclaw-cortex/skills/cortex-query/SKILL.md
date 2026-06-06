---
name: cortex-query
description: Answer questions using Tavern Cortex search, recall, page reads, backlinks, synthesis, and citations.
allowed-tools:
  - cortex_search
  - cortex_recall
  - cortex_get_page
  - cortex_list_backlinks
---

# Cortex Query

Use this skill when the user asks what Cortex knows, asks for background or notes,
asks who or what something is, asks what happened, or asks about relationships and
connections.

## Contract

This skill guarantees:

- Answers are grounded in Cortex content, not guesses.
- Durable claims cite the Cortex page slug and the page section used.
- Missing Cortex coverage is stated directly.
- Current user messages override older Cortex content.
- Conflicting Cortex evidence is called out with both sources.

## Phases

1. Decompose the question into search strategies:
   - Use `cortex_search` for exact names, slugs, keywords, dates, and quick existence checks.
   - Use `cortex_recall` for conceptual, ambiguous, planning, or "what do we know" questions.
   - Use `cortex_get_page` when the user asks for a complete picture of a known subject.
   - Use `cortex_list_backlinks` plus page links for relationship questions.
2. Execute the lightest useful search first:
   - Start with `cortex_search` for names and narrow facts.
   - Use `cortex_recall` with `mode: "conservative"` for narrow context.
   - Use `cortex_recall` with `mode: "balanced"` when prior durable context may affect the answer.
   - Use `cortex_recall` with `mode: "tokenmax"` for broad synthesis, contradictions, project history, recurring decisions, and "what do we know" work.
3. Read top results:
   - Search and recall return ranked excerpts. Use excerpts when they answer the question.
   - Read the top 3-5 pages only when excerpts confirm relevance and more context is needed.
   - For "tell me about X", read the exact page if it exists.
4. Synthesize with citations:
   - Cite page slug and section, such as `[Source: projects/tavern, compiled truth]`.
   - Cite timeline entries when answering "what happened".
   - Cite backlinks or page links when answering relationship questions.
5. Flag gaps:
   - Say "Cortex does not have information on X" when Cortex lacks support.
   - If live freshness matters, say Cortex is not the source of truth and use the appropriate live source.

## Relationship Queries

For "who knows who", "relationship between", "connections", "who works on",
"who uses", or "what depends on" questions:

- Use `cortex_get_page` to read the known subject page.
- Use its outgoing `links` for what the page points to.
- Use `cortex_list_backlinks` for what points at the page.
- Combine with `cortex_recall` only when the relationship also needs semantic context.

## Source Precedence

When Cortex sources conflict:

1. Current user message.
2. User-authored source refs and direct captures.
3. Compiled truth.
4. Timeline entries.
5. Agent-authored synthesis or external enrichment.

Do not silently pick one source. State the contradiction and cite both.

## Anti-Patterns

- Answering from general knowledge when Cortex should be checked.
- Inventing facts that are not in Cortex.
- Loading full pages before search excerpts show relevance.
- Treating old timeline entries as current truth without checking compiled truth.
- Ignoring backlinks for relationship questions.
- Hiding that Cortex has no supporting information.

## Output Shape

Prefer concise answers:

- Direct answer first.
- Short supporting bullets when useful.
- Inline citations using Cortex page slugs.
- Gap or conflict notes only when they matter.
