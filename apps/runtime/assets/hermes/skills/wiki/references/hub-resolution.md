# Hub Resolution

**HUB** is the wiki hub directory. Tavern Runtime owns it and passes it to
every agent process as `TAVERN_WIKI_HUB_PATH`.

## Protocol

1. Read `TAVERN_WIKI_HUB_PATH`. That path is HUB. Do not guess other
   locations, read other config files, or create hubs elsewhere.
2. If the variable is unset, stop and report it: Tavern Runtime is supposed to
   set it, so its absence is an environment problem, not a cue to improvise.
3. If the path cannot be statted, stop and report the missing directory.

## macOS Privacy Denials

If `stat`/existence checks succeed but reading `wikis.json` or listing
`topics/` fails with `Operation not permitted`, the hub path is correct and
macOS is blocking this process. Tell the user to grant Full Disk Access (or
iCloud Drive access, for hubs under iCloud) to the exact app launching the
agent, then restart it. Do not switch to another path for this error.

## Local Project Wikis

`--local` selects `.wiki/` in the current project instead of HUB, and a
`.wiki/` directory in the current working directory is used when present.
Everything else resolves inside HUB: named wikis come from `HUB/wikis.json`,
topics from `HUB/topics/<slug>/`.
