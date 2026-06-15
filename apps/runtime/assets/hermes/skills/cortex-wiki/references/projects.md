# Projects

Projects group related outputs — markdown deliverables, images, code, data — into a single folder with a goal. They live inside a topic wiki's `output/projects/` directory.

## Why projects exist at all

Outputs are often multi-artifact. A single deliverable can produce a markdown playbook plus images referenced by `![](screenshot.png)`, a Python prototype, a CSV export, and a generated diagram. **Relative paths only work when these artifacts colocate.** A pure metadata overlay that keeps `output/` flat and tags via frontmatter breaks the moment the first binary asset appears — markdown image links no longer resolve, scripts can't find their data files, and the user has to manually prefix every asset reference.

Project folders solve this by making colocation the primary structure. The folder *is* the project. Everything else (goal, status, members) is derivable from the folder and what's in it.

## Why `WHY.md` is the only required file

The only project state that cannot be derived from the folder is **the goal — the "why this project exists"**. Status, timestamps, and the member list are filesystem state or derivable by scanning the folder. `WHY.md` holds the precious part with no machinery: plain markdown, no frontmatter, no schema.

- First `#` heading → the project title
- Body → goal, rationale, context, current state, notes — whatever the author wants to write

LLMs rebuild wrong without rationale. LLMs don't need a manifest format to read a markdown file.

## Directory layout

```
<topic-wiki>/
└── output/
    ├── _index.md
    ├── projects/
    │   ├── bitcoin-quantum-risk/
    │   │   ├── WHY.md                  # goal + rationale (the only required file)
    │   │   ├── playbook.md             # main deliverable
    │   │   ├── threat-model.png        # assets colocated with the markdown that uses them
    │   │   ├── code/
    │   │   │   └── ecc-crack-demo.py
    │   │   └── data/
    │   │       └── key-exposure-analysis.csv
    │   ├── wiki-roadmap/
    │   │   └── WHY.md
    │   └── .archive/                   # archived projects live here
    │       └── old-thing/
    │           └── WHY.md
    └── playbook-improving-the-wiki-2026-04-08.md   # loose outputs still allowed
```

## Rules

1. **Folder is the project.** The directory name is the slug. No manifest file beyond `WHY.md`.
2. **`WHY.md` is required and non-empty.** Plain markdown. First `#` heading is the title. Body is the rationale.
3. **Multi-file or binary artifacts require a project folder.** Code, images, CSVs, SVGs, PDFs colocate with the markdown that references them. This is the whole reason projects exist.
4. **Single loose markdown outputs can stay flat in `output/`** for backward compatibility.
5. **No frontmatter schema on member files.** `project: <slug>` in frontmatter is optional sugar for Obsidian tag-based search; folder position is authoritative. If the two disagree, folder wins.
6. **Max nesting depth: 3 levels inside a project folder.** `projects/<slug>/code/file.py` is the deepest shape allowed.
7. **Slugs**: lowercase, hyphen-separated, max 40 characters. Semantic, not date-prefixed. Unique within the topic wiki.
8. **Goal is mandatory at creation.** Creating a project means creating the folder with a `WHY.md` whose body is the goal.

## Archive = move the folder

Archiving a project is a filesystem operation, not a metadata flip:

```
mv output/projects/<slug> output/projects/.archive/<slug>
```

The folder is preserved, all files stay put, git history continues. Project listings show active projects only by default; `--archived` includes `.archive/`.

Moving the folder is one operation and needs zero schema. The tradeoff is that links to archived projects from other files break — but lint already catches broken links (C4), so the existing tooling handles it.

There is no separate `retract` lifecycle state. Retraction means deleting the folder. That's a manual operation (`rm -rf`), deliberately not wrapped in a subcommand, because it's destructive and rare.

This is separate from topic-wiki archive. Topic archive moves
`HUB/topics/<slug>/` to `HUB/topics/.archive/<slug>/` and updates `wikis.json`
so an entire wiki goes quiet. Project archive only moves one project folder
inside an already selected topic wiki.

## Staleness detection

A project is **stale** when new information relevant to it has been ingested since its artifacts were last updated. This is detected by lint check C8b, not by a manifest field, and the chain runs through frontmatter that already exists:

1. Scan the project folder for member files with `sources:` in frontmatter
2. Follow each `sources:` entry to the raw source file
3. Compare the raw source's `ingested:` date to the member's `updated:` date
4. If any source is newer than the member that cites it → the project is stale

No `updated:` field on a manifest. No derived cache. Pure function over the frontmatter that already exists on every output and every raw source. Guaranteed to be accurate because it reads from the authoritative state.

## Focus / ambient project context

There is no ambient project focus and no session-state focus file. Project scope is always explicit: pass `--project <slug>` per operation when project scoping is wanted.

## What to avoid

- **Physical lifecycle folders** (`active/`, `done/`) — breaks links on status changes. Archive via `.archive/` is the one exception because it's rare.
- **Deep nesting beyond 3 levels** — `projects/<slug>/code/file.py` is the max shape.
- **Date-prefixed slugs** — dates live in filenames inside the folder, not in the slug.
- **Mandatory projects** — loose single-markdown outputs remain allowed in `output/`.
- **File duplication for multi-membership** — use markdown links to cross-reference between projects.
- **Frontmatter-driven lifecycle** — filesystem state is simpler and can't drift.

## Migration from legacy `_project.md`

Older wikis may contain `_project.md` manifests with YAML frontmatter and derived Members sections. Lint check C8c detects these and auto-migrates with this procedure:

1. Read `_project.md` frontmatter — extract `goal` and `title` (fall back to a slug-derived title if `title:` is absent).
2. Read the body and split into sections by `## ` headings.
3. Drop **derived sections**: anything between `<!-- DERIVED -->` and `<!-- /DERIVED -->` delimiters, or headed `## Members` / `## External Members` even without delimiters. These are regeneratable, not precious.
4. Preserve **human sections**: everything else, including custom sections (decision logs, open questions, retrospectives). The default is preserve — when in doubt, keep it. Custom sections are almost always rationale.
5. Surface the goal: if the body has a `## Goal` section, preserve it as-is and do not duplicate the frontmatter `goal:`. Otherwise prepend the frontmatter `goal:` text as the first body paragraph of `WHY.md`.
6. Write `WHY.md` in the same folder: first `#` heading is the title, then the goal paragraph (only if step 5 prepended it), then every preserved human section in original order with original headings.
7. Delete `_project.md`.
8. Report the migration in the lint output.

**Lossless guarantee**: every human-written section in `_project.md` appears verbatim in `WHY.md`. Only frontmatter metadata (dates, status, tags, type) and derived member lists are dropped — all recomputable. Idempotent; re-running has no effect once `WHY.md` exists.
