Based on nvk/llm-wiki `plugins/llm-wiki/skills/wiki` at v0.10.2.

Tavern adapts the upstream skill for managed Hermes:

- `TAVERN_WIKI_HUB_PATH` is the first hub source.
- Runtime copies this whole skill directory to `HERMES_HOME/skills/wiki`.
- Tavern does not install a Hermes plugin or register a wiki toolset for v1.
