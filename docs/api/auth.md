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

- Claude Code sign-in is a Runtime-owned OAuth credential created from
  Model access (code-paste flow) and stored in the runtime vault. When no
  sign-in exists, a detected host Claude Code login is used instead — this
  works on desktop Macs (a GUI session can grant keychain reads) but not on
  headless hosts, where keychain prompts cannot be answered; see
  [specs/model-access.md](../../specs/model-access.md).
  `TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN` (`claude setup-token`) remains an
  operator env escape hatch.
- Codex uses vault-backed OAuth credentials refreshed by the Runtime.
- Anthropic, OpenAI, and OpenRouter API-key routes use Runtime-stored
  provider secrets or explicit environment overrides such as
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `TAVERN_AGENT_API_KEY`.
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

## Identity And Sign-In

Normative model: [specs/identity.md](../../specs/identity.md). Summary of the
implemented surface:

- Tavern App requires Clerk sign-in when `VITE_CLERK_PUBLISHABLE_KEY` is set
  (dev: `apps/website/.env.local`, pulled with `clerk env pull`). Keyless
  builds run a signed-out dev mode with no gate; e2e forces keyless. If
  clerk-js cannot load (offline), the app renders local data on the cached
  identity instead of locking the user out.
- The app attaches the Clerk session token to server requests
  (`Authorization: Bearer`, websocket `connectionParams.clerkSessionToken`);
  the server exposes it as `ctx.clerkSessionToken`.
- The Runtime verifies forwarded Clerk tokens against the instance JWKS when
  `TAVERN_CLERK_PUBLISHABLE_KEY` (or `clerkPublishableKey` in `tavern.json`)
  is set. Verified users are minted `identity_users` rows keyed by tavern
  user id; the first verified user to connect claims an unclaimed runtime as
  `owner`. Non-members can only introspect `/identity/me` and redeem
  invites. The `identity` capability reports this state.
- The runtime token remains the owner transport credential and bypasses
  membership. `CLERK_SECRET_KEY` is CLI/dev-only and must never ship in
  client code or version control.
