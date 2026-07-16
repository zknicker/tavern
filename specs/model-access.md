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

## Claude Code and Anthropic

Two providers, one per credential — the same split as Codex (sign-in)
versus OpenAI (API key). Both execute through the Claude Code harness and
expose the same curated Claude models under their own provider ids.

- **Claude Code (`claude`) — sign-in.** Stored under `model-access:claude`.
  The runtime executes a code-paste PKCE OAuth flow against the public
  Claude Code client: `start` returns an authorize URL
  (`claude.ai/oauth/authorize`, `code=true`), the user approves in any
  browser and pastes the displayed `code#state` back, and the runtime
  exchanges it at `platform.claude.com/v1/oauth/token`. Code-paste is
  deliberate: the approving browser can be anywhere, so the flow works for
  remote Runtimes (a Mac mini reached over Tailscale) exactly like local
  ones. Uses the account's Claude subscription.
- **Anthropic (`anthropic`) — API key.** Stored under
  `model-access:anthropic` (`ANTHROPIC_API_KEY` option in Model access).
  Pay-per-token API billing.

The `claude` provider also rides a **detected host Claude Code login**
(mirroring Raft's default "host login" mode): when the machine's operator
is already signed in to Claude Code — keychain item on macOS,
`~/.claude/.credentials.json` elsewhere — the provider reads `live`
("Using your Claude Code login.") with zero setup and the engine discovers
that credential itself. Detection checks presence only, never credential
values, and `TAVERN_AGENT_CLAUDE_CODE_HOST_LOGIN=0` disables it. Host
login is convenient but fragile on servers (keychain ACLs bind to binary
identity and headless sessions cannot answer prompts — the v1.5.0 mini
outage); runtime-owned sign-in always wins when both exist and is the
recommended setup for deployed hosts.

Turn-time contract: before every `claude`-provider turn the runtime
refreshes the access token when it is within five minutes of expiry
(refresh grant, rotated refresh tokens written back). Each turn injects
its provider's credential into the Claude Code harness (`authToken` for
`claude`, `apiKey` for `anthropic`). The engine's own credential discovery
(keychain, `~/.claude`) is never relied on. Environment overrides
(`TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`, base URL
variants) remain operator-level escape hatches and lose to stored
credentials.

Provider catalog: both providers' access states are credential-driven —
`needs-auth` until connected, regardless of CLI presence on the host. The
`claudeAuth` capability tracks sign-in only (healthy with account metadata
when connected, unauthorized with a connect pointer otherwise). Turn
failures caused by auth name the fix: "Claude is not connected. Connect
Claude in Settings → Connections → Model access." for sign-in, the
API-key equivalent for `anthropic` — never CLI instructions.

## Codex, OpenAI, OpenRouter

Codex OAuth credentials are vault-backed with runtime refresh (see
`codex-oauth-refresh`); OpenAI and OpenRouter are API-key providers. New
providers follow the same rule: the runtime owns the credential, Model
access owns the setup UX, a capability owns the health story.
