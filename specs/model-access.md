---
summary: Runtime-owned model provider credentials — Claude sign-in (code-paste OAuth), API keys, refresh, and the capability contract.
read_when:
  - changing model provider authentication, credential storage, or refresh
  - adding a provider connect flow to Model access
  - changing Claude/Codex sign-in behavior or the claudeAuth capability
---

# Model Access

Model provider credentials are **Runtime-owned**. They live in the runtime
vault (`tavern_vault_secrets`), never in OS keychains or engine-side stores —
a headless Runtime cannot answer keychain prompts, and engine credential
stores do not survive upgrades. The app configures access through Model
access in Settings; agents never see raw credentials in prompts or tools.

## Claude

Two credential shapes, stored together under `model-access:claude`:

- **Sign-in (preferred).** The runtime executes a code-paste PKCE OAuth flow
  against the public Claude Code client: `start` returns an authorize URL
  (`claude.ai/oauth/authorize`, `code=true`), the user approves in any
  browser and pastes the displayed `code#state` back, and the runtime
  exchanges it at `platform.claude.com/v1/oauth/token`. Code-paste is
  deliberate: the approving browser can be anywhere, so the flow works for
  remote Runtimes (a Mac mini reached over Tailscale) exactly like local
  ones.
- **API key.** A plain Anthropic key (`ANTHROPIC_API_KEY` option in Model
  access) as the escape hatch. Sign-in wins when both exist.

Turn-time contract: before every Claude-provider turn the runtime refreshes
the access token when it is within five minutes of expiry (refresh grant,
rotated refresh tokens written back), then injects the credential into the
Claude Code harness (`authToken` for sign-in, `apiKey` for keys). The
engine's own credential discovery (keychain, `~/.claude`) is never relied
on. Environment overrides (`TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN`,
`ANTHROPIC_AUTH_TOKEN`, base URL variants) remain operator-level escape
hatches and lose to stored credentials.

Provider catalog: Claude's access state is credential-driven — `needs-auth`
until connected, regardless of CLI presence on the host. The `claudeAuth`
capability mirrors this (healthy with account metadata when connected,
unauthorized with a connect pointer otherwise). Turn failures caused by
Claude auth surface as "Claude is not connected. Connect Claude in
Settings → Connections → Model access." — never CLI instructions.

## Codex, OpenAI, OpenRouter

Codex OAuth credentials are vault-backed with runtime refresh (see
`codex-oauth-refresh`); OpenAI and OpenRouter are API-key providers. New
providers follow the same rule: the runtime owns the credential, Model
access owns the setup UX, a capability owns the health story.
