Tavern-owned Cortex wiki skill.

Runtime package notes:

- `TAVERN_WIKI_HUB_PATH` is the first hub source.
- Runtime copies this whole skill directory to `HERMES_HOME/skills/cortex-wiki`.
- Tavern does not install a Hermes plugin or register a wiki toolset.
- Routine maintenance (compile, librarian, todo processing) is driven by
  Tavern Runtime jobs, not slash commands or schedules; the run prompts live
  in `apps/runtime/src/wiki/`.
