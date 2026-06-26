# Compatibility Vault Contract

`vault` is the compatibility name for Tavern's Memory file API.

The product concept is Memory. User-facing navigation, settings, docs, and
agent prompts should say Memory. Wire routes and TypeScript types can keep
`vault` until a deliberate API rename happens.

## Compatibility Surface

Runtime still serves:

* `/vault/status`
* `/vault/settings`
* `/vault/pages`
* `/vault/pages/:path`
* `/vault/folders`
* `/vault/move`
* `/vault/search`

The app still calls tRPC procedures under `vault.*`.

## Status Mapping

`status.indexExists` reports whether `TAXONOMY.md` exists in the Memory root.

`vaultPath` is the Memory root path.

`TAVERN_VAULT_PATH` remains the environment override until the wire setting is
renamed.

## Migration Rule

Do not add new product behavior under a user-facing Vault label. New behavior
belongs to Memory. Compatibility work should be scoped to old routes, old API
names, and migration shims.
