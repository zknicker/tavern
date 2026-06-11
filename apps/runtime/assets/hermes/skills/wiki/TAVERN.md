Tavern-owned wiki skill. Forked from nvk/llm-wiki
`plugins/llm-wiki/skills/wiki` at v0.10.2; no longer tracks upstream.

Tavern divergences from the original:

- `inventory/` is renamed `todos/` throughout (directory, reference doc,
  operation name, record language). Todos are Tavern's product noun for the
  wiki's follow-up queue, processed automatically by Runtime jobs.
- `TAVERN_WIKI_HUB_PATH` is the first hub source.
- Runtime copies this whole skill directory to `HERMES_HOME/skills/wiki`.
- Tavern does not install a Hermes plugin or register a wiki toolset.
- Routine maintenance (compile, librarian, todo processing) is driven by
  Tavern Runtime jobs, not slash commands or schedules; the run prompts live
  in `apps/runtime/src/wiki/`.
