---
summary: Live managed Hermes patch that applies configured default model runtime before the first prompt of a fresh session.
read_when:
  - changing the gateway-default-model-runtime managed Hermes patch
  - debugging fresh Tavern chats that fail until /model is run
  - upgrading the Hermes engine while this patch is live
---

# Hermes Default Model Runtime Patch

`gateway-default-model-runtime` is a managed Hermes patch adjacent to upstream
Hermes PR
[#45085](https://github.com/NousResearch/hermes-agent/pull/45085). That PR
added `_sync_agent_model_with_config()`, which re-resolves the configured model
at turn start and applies it through the same model-switch path as `/model`.

The patch fixes the remaining fresh-session gap. A fresh Tavern chat must honor
the Hermes configured default model before the first prompt, without Tavern
issuing a session-specific `/model` command and without disabling prompt
caching.

The managed engine pin is:

```text
5937b95192bc02a98a8a29d44caffd71f2b25694
```

## Symptom

When Tavern Settings set the agent model to:

```text
anthropic/claude-opus-4-8
```

a fresh chat failed with:

```text
HTTP 400: You're out of extra usage. Add more at claude.ai/settings/usage and keep going.
```

The same chat started working after:

```text
/model anthropic/claude-opus-4-8
```

That proves the account, model entitlement, and Hermes model API update were
valid. The missing piece was fresh-session runtime state.

## Source Shape

A dashboard or Tavern settings update writes the configured default as:

```yaml
model:
  default: claude-opus-4-8
  provider: anthropic
```

At this pin, the Gateway lazy agent build seeds:

```python
current["config_model_seen"] = _config_model_target()
```

That is right for avoiding repeated sync attempts, but it is not enough for a
fresh session. A narrower experiment baselined the sync from the built agent so
upstream #45085 could run on the first prompt. That still failed: the built
agent already reported `model=claude-opus-4-8 provider=anthropic`, so
`_sync_agent_model_with_config()` treated the target as already running and did
not call the model-switch path.

The important difference is not only `model` and `provider`. The fresh session
must start with the full runtime tuple:

```json
{
  "model": "claude-opus-4-8",
  "provider": "anthropic",
  "base_url": "https://api.anthropic.com",
  "api_mode": "anthropic_messages"
}
```

and the same internal system marker Hermes uses after `/model`. The failed
#45085-only smoke logged `history=0` on the fresh turn and still returned the
extra-usage error.

An earlier managed-patch candidate built the agent first, then called Hermes's
full model-switch resolver and `agent.switch_model()`. It was correct, but it
put live switch work on new-chat startup. Local timing on the managed engine
showed:

```text
switch_model: p50=185.37ms p95=298.03ms max=621.73ms
resolve_runtime_provider: p50=16.35ms p95=18.20ms max=23.99ms
```

The live patch uses the cheaper startup-runtime resolver before `_make_agent()`
and passes the resolved tuple into agent construction. That avoids a
build-then-switch path while still giving the first prompt the same runtime
metadata.

## Patch Behavior

The patch has one source edit:

| Target | Behavior |
| --- | --- |
| `tui_gateway/server.py` lazy agent build | Resolves the configured default runtime before `_make_agent()` when the session has no per-session override, passes that tuple into agent construction, then persists the runtime tuple and internal marker. |

The patch does not emit a user-visible `/model` command. It does not make
Tavern patch canonical chat history. It also does not change Anthropic prompt
caching. It does not pin the session as a user-selected override; later config
changes still flow through Hermes's normal config sync.

## Verification

The verification path must be a fresh Tavern chat, not an existing chat fixed
with `/model`.

Required smoke:

1. Set the agent model in Settings to a different model.
2. Set it back to `anthropic/claude-opus-4-8`.
3. Start a new chat with a plain first message.
4. Wait for the turn to finish.
5. Confirm the UI shows an assistant response and not the extra-usage error.
6. Confirm Hermes session storage records:

```text
model=claude-opus-4-8
billing_provider=anthropic
billing_base_url=https://api.anthropic.com
api_mode=anthropic_messages
```

The June 24, 2026 smoke created session `20260624_143535_2f3580`; it completed
one Anthropic API call and returned an assistant response without `/model`.

The optimized patch smoke later created chat
`cht_d0359bb5-98c7-4c3c-9d65-d1e57c6b2e03` and Hermes session
`20260624_153202_c8badf`. The chat completed without a `Model
switched in-place` log, proving the fresh agent was constructed with the
configured runtime instead of doing a build-then-switch.

## Removal

Remove this patch after Hermes natively applies the configured default through
the same session state transition as `/model`, including:

* resolved `base_url`, credentials, and `api_mode`
* persisted session runtime state
* refreshed cached system prompt
* internal model-switch marker or an upstream replacement with equivalent
  semantics
* preserving `/model`-pinned session behavior
* preserving Anthropic prompt-cache policy

When a Hermes update appears to cover this contract, run Removal Validation
against the new pin before deleting the patch.

## Removal Validation

Use this section only when a Hermes pin update gives strong evidence that
upstream may now satisfy this contract. Routine pin bumps that do not touch
fresh-session model runtime state should keep the patch without spending a live
removal smoke.

Setup:

1. Update the Hermes pin under `apps/runtime/src/hermes/engine.ts`.
2. Temporarily remove the `gateway-default-model-runtime` entry from
   `apps/runtime/src/hermes/engine-patches.ts`.
3. Use a clean managed install for the new pin. If reusing an existing managed
   install, run `tavern engine repair` after removing the patch entry.
4. Start the managed stack with system Hermes disabled:

```bash
TAVERN_HERMES_ALLOW_SYSTEM=0 TAVERN_HERMES_AUTO_INSTALL=1 bun run dev:web:runtime
```

Smoke:

1. In Settings -> Agent -> Model, set the model to any non-Anthropic model that
   can save successfully.
2. Set it back to `anthropic/claude-opus-4-8`.
3. Start a brand-new chat with:

```text
Codex smoke <date time> default model removal validation
```

4. Wait for the turn to complete.

Pass criteria:

* The UI receives an assistant response without sending `/model`.
* The UI does not show `HTTP 400: You're out of extra usage`.
* Hermes logs show the first turn for the new session using
  `model=claude-opus-4-8 provider=anthropic`.
* Hermes session storage records:

```text
model=claude-opus-4-8
billing_provider=anthropic
billing_base_url=https://api.anthropic.com
model_config.api_mode=anthropic_messages
```

* The first-turn history includes the model-runtime marker, or upstream has an
  equivalent persisted runtime signal that answers "what model/provider is
  active?" correctly in the fresh chat.

Fail criteria:

* The fresh chat returns the extra-usage error.
* The chat only works after manually sending `/model anthropic/claude-opus-4-8`.
* The session row lacks `api_mode=anthropic_messages`, `billing_provider`, or
  `billing_base_url`.
* Hermes logs show the first turn running before the configured runtime is
  persisted.

Cleanup:

* Archive only the smoke chat created for validation.
* Stop the dev stack and confirm the worktree's dev ports are clear.
* If the unpatched pin passes, delete this patch and its index row. If it
  fails, keep the patch and update its source match for the new upstream file
  shape.
