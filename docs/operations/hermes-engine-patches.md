---
summary: Live Tavern-managed patches applied to the pinned Hermes engine install, including rationale, evidence, source touchpoints, and removal rules.
read_when:
  - changing managed Hermes live patches or the engine patch applicator
  - debugging managed Hermes behavior that differs from upstream Hermes
  - upgrading the Hermes engine while Tavern carries live patches
  - changing Codex Responses streaming, assistant deltas, or final message delivery
---

# Hermes Engine Patches

Tavern prefers upstream Hermes fixes. A live patch is allowed only when the
managed engine pin has a user-visible correctness bug and Tavern needs the
fixed contract before the next safe Hermes bump.

Live patches are product infrastructure, not local operator edits. Runtime
applies them to the managed install under `~/.tavern/engine/<pin>/hermes-agent`
while holding the engine install lock. Applied patch ids and checksums are
written to `~/.tavern/engine/<pin>/install.json`.

The patch manifest lives in `apps/runtime/src/hermes/engine-patches.ts`.

## Patch Lifecycle

1. Add a patch entry to `managedHermesEnginePatches`.
2. Keep the patch id stable and descriptive.
3. Match the smallest exact upstream source block that proves the expected
   engine shape.
4. Replace only the lines required for the managed contract.
5. Document the context in this file before shipping.
6. Run managed Runtime tests and a real managed-engine smoke when the bug needs
   live provider evidence.

Patch application is idempotent. If the replacement already exists, startup
continues. If the expected source block no longer exists, startup fails with a
managed-Hermes setup error. That failure is intentional: a changed upstream
file means the patch must be reviewed during the engine upgrade rather than
silently skipped.

`TAVERN_HERMES_BIN` and system-tier Hermes installs are not patched. Patches
apply only to Tavern-managed engine installs because those are the installs
Tavern acquires and pins.

## Live Patches

There are no active live patches.

The patch applicator remains in Runtime so Tavern can carry a narrow managed
engine patch when a future pinned-engine correctness issue requires it. Keep
this page current whenever `managedHermesEnginePatches` is non-empty.

## Retired Candidate: `suppress-openai-codex-unstable-output-text-delta`

### Contract Under Investigation

Hermes Gateway `message.delta` must be an append-only prefix of the eventual
`message.complete.text` for the same assistant message.

Tavern relies on that contract so live assistant text can stream app-locally
and then reconcile to the durable final message without visible reflow. If
Hermes emits one text source live and a different text source at completion,
Tavern cannot repair the stream without either hiding the response until
completion or inventing provider-specific text replacement semantics.

### Observed Failure

On June 17, 2026, Tavern debug logging captured an `openai-codex` turn where
raw Hermes Gateway events diverged:

* live `message.delta` frames carried assistant text with `textNewlines: 0`
* final `message.complete` carried the same response with `textNewlines: 15`
* `reasoning.available` also carried the final formatted text

The visible result was a reply streaming as one long line:

```text
The morning opens, slow and still,with blue sky spilling on the sill.Cold brew waits...
```

and then reformatting at completion:

```text
The morning opens, slow and still,
with blue sky spilling on the sill.
Cold brew waits...
```

At first this looked like proof that Hermes was not emitting live newlines.
That conclusion was wrong. Tavern's raw Gateway logger used the same trimmed
string reader as the stream mapper, so whitespace-only deltas were logged as
empty strings with `textLength: 0`.

### Hermes Source Shape

The managed engine pin was:

```text
c9863772368720a892faaa6e1f3402dbea72f4bf
```

Relevant upstream files at that pin:

| File | Behavior |
| --- | --- |
| `tui_gateway/server.py` | The Gateway `_stream(delta)` callback appends the delta and emits `message.delta` with `{"text": delta}`. |
| `agent/codex_runtime.py` | `_consume_codex_event_stream` reads `response.output_text.delta`, appends it to `collected_text_deltas`, and calls `on_text_delta(delta_text)`. `run_codex_stream._on_text_delta` then calls `agent._fire_stream_delta(text)`. |
| `agent/codex_responses_adapter.py` | `_normalize_codex_response` builds the final assistant content from `response.output_item.done` message items first, and only falls back to `response.output_text` when no message item exists. |

That means live and final text come from different Responses event families:

```text
live:  response.output_text.delta  -> message.delta
final: response.output_item.done    -> message.complete
```

The Tavern bug had two layers:

* `apps/runtime/src/hermes/local-client.ts` read Gateway stream text through
  `readString(...)`, and `readString` returns a value only when
  `value.trim()` is non-empty. Newline-only or space-only Gateway deltas were
  therefore dropped before they reached `hermes-turn-runner.ts`, and the debug
  logger produced misleading `textLength: 0` evidence for those frames.
* `apps/runtime/src/tavern/hermes-turn-runner.ts` then read the already mapped
  `assistant.delta` through its own trimmed `readString(...)`. After the
  client fix, raw newline chunks reached the runner but were still discarded
  before `turn.replyUpdated` reached the app.

### Retired Patch Behavior

The patch is intentionally narrow:

* it only changes `run_codex_stream._on_text_delta`
* it still collects `output_text.delta` into `_codex_streamed_text_parts`
* it suppresses `agent._fire_stream_delta(text)` only when
  `agent.provider == "openai-codex"`
* other Responses-compatible providers keep their existing live
  `output_text.delta` streaming behavior

This patch was tested and immediately retired. It prevented the reflow, but it
also removed live answer streaming for `openai-codex`, because the visible text
deltas were the path it suppressed.

### Actual Fix

Tavern now reads stream text with raw string readers that preserve
whitespace-only strings. The Gateway-client fix applies to:

* `message.delta` -> `assistant.delta`
* `message.complete.text` -> `assistant.completed.content`
* `reasoning.delta` and `reasoning.available`
* `status.update.text`
* debug logging for raw Gateway stream events

The turn-runner fix applies the same rule to:

* `assistant.delta` live reply accumulation and `turn.replyUpdated`
* `reasoning.delta` accumulation for stored Thinking activity

The normal trimmed `readString(...)` helper remains right for ids, labels,
tool names, model names, and status kinds. It is not right for streamed text.

### Why Not Suppress Hermes Deltas

Suppressing Hermes deltas is the wrong fallback for this failure mode. It makes
the final answer correct, but removes live answer streaming. If this symptom
returns, first verify the raw Gateway text with `TAVERN_CHAT_DEBUG=1` after the
raw-reader fix:

```text
joined(message.delta.text) == message.complete.text
```

For poem/list/paragraph turns, the debug logs should show whitespace-only
`message.delta` frames with non-zero `textLength` and `textNewlines` when the
provider streams line breaks separately.
