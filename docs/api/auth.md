---
summary: Local-owner trust model for Tavern App, Runtime credentials, model-provider credentials, external clients, and secret storage.
read_when:
  - changing local app auth, runtime trust, secrets, or operator identity
  - exposing Tavern API access to external clients
---

# Auth

Tavern is a local-owner app. The owner controls the App process, Runtime host,
workspace files, and model-provider credentials.

## Trust Boundaries

| Boundary | Trust |
| --- | --- |
| Electron shell and local Node app | One Tavern App product boundary |
| Tavern App to Tavern Runtime | Paired local transport with runtime credentials |
| Runtime to model providers | Provider-specific local OAuth or API-key credentials |
| External client to Tavern API | Explicit Tavern-issued credentials when exposed |
| Agent/tool access to Tavern data | Narrow tool/API capability, not raw database access |

## Secrets

Model provider credentials belong to their provider integration:

- Claude Code and Codex use the local OAuth sessions owned by their CLIs.
  Claude Code Runtime turns may also use `TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN`
  from `claude setup-token` when non-interactive `claude -p` cannot use the
  local Claude.ai login.
- OpenAI/API-key routes use Runtime-stored provider secrets or explicit
  environment overrides such as `OPENAI_API_KEY` or `TAVERN_AGENT_API_KEY`.
- Plugin credentials live in Plugin-specific secret storage.

Do not put secrets in:

- Chat messages
- response activity metadata
- e2e scripts
- checked-in config
- checked-in env files

Telemetry-only credentials belong to the feature that reads telemetry. For
example, OpenRouter account activity uses a management key stored as Stats
source settings, not as an inference credential.

## Runtime Access

The Runtime HTTP API is protected by the configured Tavern Runtime token. The
Runtime generates a token on first start and keeps it in its host config file
(`<runtime-root>/tavern.json`, `token` key, mode `0600`). Override with
`TAVERN_RUNTIME_TOKEN`. The health route is unauthenticated.

When the Runtime host is remote, run `tavern token` on the host to display the
pairing token, then save that token in the App settings.

Clients use Tavern API or TypeScript SDK surfaces instead of reading local
SQLite files, runtime stores, or executor state directly.
