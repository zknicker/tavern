---
summary: Retired managed Hermes patch candidate for OpenAI Codex stream delta formatting.
read_when:
  - investigating OpenAI Codex streaming reflow or whitespace-only deltas
  - reviewing retired managed Hermes patch candidates
---

# OpenAI Codex Stream Delta Candidate

`suppress-openai-codex-unstable-output-text-delta` was a retired candidate,
not a live patch.

## Contract Under Investigation

Hermes Gateway `message.delta` must be an append-only prefix of the eventual
`message.complete.text` for the same assistant message.

Tavern relies on that contract so live assistant text can stream app-locally
and then reconcile to the durable final message without visible reflow. If
Hermes emits one text source live and a different text source at completion,
Tavern cannot repair the stream without either hiding the response until
completion or inventing provider-specific text replacement semantics.

## Observed Failure

On June 17, 2026, Tavern debug logging captured an `openai-codex` turn where
raw Hermes Gateway events appeared to diverge:

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

## Hermes Source Shape

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

## Retired Patch Behavior

The candidate patch was intentionally narrow:

* it only changed `run_codex_stream._on_text_delta`
* it still collected `output_text.delta` into `_codex_streamed_text_parts`
* it suppressed `agent._fire_stream_delta(text)` only when
  `agent.provider == "openai-codex"`
* other Responses-compatible providers kept their existing live
  `output_text.delta` streaming behavior

This patch was tested and immediately retired. It prevented the reflow, but it
also removed live answer streaming for `openai-codex`, because the visible text
deltas were the path it suppressed.

## Actual Fix

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

## Why Not Suppress Hermes Deltas

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
