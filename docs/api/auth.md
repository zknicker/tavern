---
summary: Local-owner trust model for Tavern App, Runtime credentials, managed OpenClaw access, external clients, and secret storage.
read_when:
  - changing local app auth, runtime trust, secrets, or operator identity
  - exposing Tavern API access to external clients
---

# Auth

Tavern is a local-owner app.

The owner is the person running the app and the paired Tavern Runtime. Auth is
therefore narrower than a hosted team chat server, but every boundary still
needs explicit trust.

## Trust Boundaries

| Boundary | Trust Rule |
| --- | --- |
| Electron shell and local Node app | One Tavern App product boundary |
| Tavern App to Tavern Runtime | Paired local transport with runtime credentials |
| Tavern Runtime to managed OpenClaw | Generated Gateway credentials and runtime config |
| External client to Tavern API | Explicit Tavern-issued credentials when exposed |
| Agent/tool access to Tavern data | Narrow tool/API capability, not raw database access |

## Secrets

Secrets belong in Tavern-owned storage such as Tavern Vault or generated runtime
config.

Do not put secrets in:

* docs
* fixtures
* e2e scripts
* checked-in runtime config
* OpenClaw transcript metadata

## Runtime Access

The app talks to Tavern Runtime through the configured runtime URL and runtime
credentials. Managed OpenClaw receives generated Gateway credentials from
Tavern Runtime.

Clients use Tavern API or TypeScript SDK surfaces instead of reading local
SQLite files, runtime stores, or OpenClaw state directly.

## Local-Owner Model

Tavern does not model hosted teams, workspace roles, OAuth login, or public
multi-tenant API tokens as core auth concepts.

Those features can be added without changing the local-owner rule: privileged
access enters through explicit Tavern credentials and narrow capabilities.
