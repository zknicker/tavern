---
summary: Cortex CLI commands for capture, page edits, search, recall, embedding, status checks, and Runtime job polling.
read_when:
  - using or changing tavern cortex CLI commands
  - testing Cortex capture, recall, search, embeddings, or status from a terminal
  - comparing the Tavern Cortex CLI to GBrain CLI behavior
---

# Cortex CLI

The Cortex CLI is part of the Tavern Runtime CLI. It is a thin client for the
managed Runtime, so it requires a running Runtime and uses `TAVERN_RUNTIME_URL`
or `http://127.0.0.1:18790` by default.

Use `tavern --help` for the built-in help surface.

## Commands

| Command | Purpose |
| --- | --- |
| `tavern cortex capture <text>` | Save explicit durable knowledge to Cortex. |
| `tavern cortex capture --stdin` | Capture piped text. |
| `tavern cortex ingest <kind> <text>` | Ingest normalized source-backed text. |
| `tavern cortex get <slug>` | Print one Cortex page. |
| `tavern cortex list` | List Cortex pages. |
| `tavern cortex put <slug> --stdin` | Rewrite or create a Cortex page. |
| `tavern cortex delete <slug>` | Delete a Cortex page from active knowledge. |
| `tavern cortex restore <slug>` | Restore an archived Cortex page. |
| `tavern cortex history <slug>` | Show page version history. |
| `tavern cortex revert <slug> <version>` | Revert a page to a prior version. |
| `tavern cortex tag <slug> <tag>` | Add a page tag. |
| `tavern cortex untag <slug> <tag>` | Remove a page tag. |
| `tavern cortex tags <slug>` | List page tags. |
| `tavern cortex link <from> <to> --type <type>` | Add a typed page link. |
| `tavern cortex unlink <from> <to> --type <type>` | Remove an explicit frontmatter link. |
| `tavern cortex backlinks <slug>` | List inbound links to a page. |
| `tavern cortex graph-query <slug>` | Traverse Cortex page links. |
| `tavern cortex timeline <slug>` | List page timeline entries. |
| `tavern cortex timeline-add <slug> <date> <text>` | Add a dated timeline entry. |
| `tavern cortex search <query>` | Search Cortex pages and chunks. |
| `tavern cortex search <query> --explain` | Include per-result ranking diagnostics. |
| `tavern cortex search diagnose <query> --target <slug>` | Trace why a target page did or did not rank. |
| `tavern cortex search modes` | Show recall/search mode settings. |
| `tavern cortex search stats` | Show search readiness counts. |
| `tavern cortex recall <query>` | Build recall context for agent or synthesis work. |
| `tavern cortex embed --stale` | Generate embeddings for stale or missing chunks. |
| `tavern cortex status` | Show page, chunk, embedding, and index counts. |
| `tavern cortex stats` | Show GBrain-style Cortex statistics. |
| `tavern cortex health` | Show Cortex health recommendations. |

Most read commands support `--json` for machine-readable output.

## Capture

```bash
tavern cortex capture "Blippy prefers short replies" \
  --title "Blippy Reply Style" \
  --type preference \
  --tag agent
```

Capture writes a Cortex page through the Runtime API. The Runtime records
source metadata, parses the page, and marks chunks for later embedding.

## Ingest

```bash
tavern cortex ingest article --file ./note.txt \
  --locator https://example.com/note \
  --title "Example Note" \
  --tag source
```

Ingest registers source-backed text and writes a Cortex `source` page with
provenance. Use it for normalized source material from future product adapters:
webhooks, email, calendar, voice notes, articles, or other bounded text sources.

This is not bulk markdown import. It is the shared Runtime lane that source
adapters can call before Chat Ingestion, Dream, search, recall, and embeddings
operate on the material.

## Page Operations

```bash
tavern cortex get blippy-profile
tavern cortex list --limit 20
echo "full page body" | tavern cortex put blippy-profile --stdin --title "Blippy Profile"
tavern cortex delete blippy-profile
tavern cortex history blippy-profile
tavern cortex revert blippy-profile 1
```

`put` rewrites the page body and compiled truth. Use it for explicit whole-page
knowledge updates, matching GBrain's full-page write model.

`delete` removes the page from active Cortex knowledge, clears derived rows, and
leaves an audit tombstone. `restore` is for archived pages, not deleted pages.

Runtime records a page version whenever managed Cortex markdown projection sees
new page content. `history` lists those snapshots newest first. `revert` applies
one historical snapshot through the normal page edit path, so the revert itself
becomes a new version.

## Graph And Timeline

```bash
tavern cortex link blippy-profile reply-style --type related_to
tavern cortex backlinks reply-style
tavern cortex graph-query blippy-profile --depth 2 --direction both
tavern cortex timeline blippy-profile
tavern cortex timeline-add blippy-profile 2026-06-04 "Changed reply guidance."
```

`graph-query` runs a Runtime-side recursive traversal over typed Cortex edges.
It supports `--type`, `--depth`, and `--direction in|out|both`.

`unlink` removes explicit frontmatter links created through Cortex page metadata.
It does not rewrite wikilinks embedded in markdown body content.

## Recall

```bash
tavern cortex recall "what should I know before replying?" --mode balanced
```

Recall supports the same read-budget modes as the Memory settings page:
`conservative`, `balanced`, and `tokenmax`.

`tavern cortex search modes` shows the active mode. `tavern cortex search stats`
shows graph, timeline, and embedding counts that affect recall readiness.

Search supports `--limit`, `--offset`, and `--explain`. Explain mode returns
lexical score, vector score, evidence labels, rank, and create-safety hints.
`search diagnose` runs the same explained search and reports whether the target
page appears in the top result window.

## Stats

```bash
tavern cortex stats
```

Tavern does not expose GBrain-style markdown import or extract backfill. Cortex
knowledge enters through Runtime-owned capture, source ingest, page edit,
Chat Ingestion, Dream, and future product ingestion surfaces. Runtime still
projects its managed markdown wiki into Cortex internally.

## Verification

Run the focused CLI tests when changing the command surface:

```bash
bun run --filter @tavern/runtime test -- src/cli.test.ts
```

The runtime CLI e2e test covers capture, source ingest, search, search
diagnostics, recall, stale embeddings, status, graph traversal, timeline edits,
page history, revert, and stats through the Runtime router.
