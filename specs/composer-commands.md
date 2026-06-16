---
summary: Composer slash commands — the / palette, the engine command catalog, and command execution in a chat's session.
read_when:
  - changing composer / autocomplete, the command palette, or command execution
  - changing how Tavern lists or runs agent engine commands
  - adding command kinds, command output rendering, or command gating
---

# Composer Commands

Typing `/` at the start of the composer in an existing chat opens a command
palette. Commands are agent actions executed in the chat's session — they are
not mentions and never serialize into message markdown or metadata.

## Triggers

- `/` opens the palette only when it is the first character of the composer.
  A `/` typed mid-message (paths, URLs, prose) never triggers it.
- The palette filters the catalog as the user types (`/mod` matches `/model`).
- Selecting a command inserts `/name ` as plain text; the user may add
  arguments and submits normally. No chip is created.
- Submitting bare `/model` opens model completion in the composer. Picking a
  model runs `/model <provider/model>` in the chat session.
- The palette is available only where a chat session exists. The new-chat
  composer does not offer commands.
- Context-management commands such as `/context`, `/compact`, or `/compress`
  show the current context fullness when the app can resolve model usage and
  context window data.

## Catalog

The command catalog comes from the agent engine's gateway (`commands.catalog`),
which returns categorized `[name, description]` pairs. Tavern uses the
categorized entries only, and additionally drops the engine's `TUI` category —
those commands (such as `/logs` and `/sessions`) only work inside the engine's
own terminal client. Skill-invocation commands are excluded in v1.

Tavern Runtime exposes the catalog at `GET /commands` and the app reads it
through `agent.commands`. The catalog is gated on the `gateway` capability.

### Command treatments

Every engine command gets exactly one of three treatments:

1. **Run in the session (default).** The command executes through the engine
   and its output lands as a command card. This covers session, configuration,
   info, and tools/skills commands (`/usage`, `/model`, `/compress`,
   `/skills`, ...). Tavern does not invent their semantics. `/model` uses the
   engine's session `config.set` path, matching the engine client. `/model`
   and `/reasoning` are deliberately session-scoped overrides: they tune the
   current chat-bound engine session and never write Tavern agent settings.
2. **Tavern binding commands.** Hermes owns native session identity,
   transcripts, reset semantics, model overrides, and tool state. Tavern owns
   the binding between a Tavern chat participant and a Hermes session. `/new`
   and `/clear` rotate that binding; `/clear` additionally clears the Tavern
   timeline (see Execution). `/status` reads the current binding without
   opening a new engine session. Their catalog descriptions are rewritten
   ("Start fresh context without clearing the chat", "Clear the chat and start
   fresh context", and "Show this chat's agent session status").
3. **Suppressed.** Runtime drops these from the catalog and rejects direct
   runs, for one of four reasons:
   - They act on the engine's own terminal client or its host machine, which
     has no meaning inside a Tavern chat: `/redraw`, `/statusbar`, `/skin`,
     `/indicator`, `/busy`, `/verbose` (terminal display), `/copy`, `/paste`,
     `/image` (host clipboard), `/quit` (client process), `/update` (the
     engine install is Tavern-managed and pinned), `/snapshot` (engine state
     snapshots, blocked in the slash worker), `/handoff` (terminal session
     handoff), and `/debug` (uploads host system info and logs to external
     share links).
   - They manipulate session identity or rewrite history, which does not fit
     Tavern's chat model: `/undo` (rewinds engine context while the canonical
     timeline keeps showing the undone turns), `/resume` and `/sessions`
     (point the engine at another stored session without updating the synced
     session mapping), `/branch` (forks an engine session no Tavern chat can
     see), `/save` (manual session persistence; synced sessions persist
     automatically), and `/title` (chat titles are Tavern-owned state). In
     Tavern, session identity is the chat you have open, and chat history is
     canonical — "get back on track" is served by steering, `/compress`,
     `/clear`, and dismissal instead.
   - They manage subsystems or presentation Tavern owns: `/memory` reviews
     the write-approval queue of the engine's built-in curated memory, which
     Tavern disables (`memory_enabled = false`) in favor of Cortex via the
     managed Mnemosyne provider; `/yolo` toggles dangerous-command approval
     skipping out from under Tavern's permission settings; `/footer` and
     `/voice` are messaging-platform reply presentation Tavern renders
     itself; `/help` prints the engine's full command list, contradicting
     the palette.
   - They depend on the engine client resubmitting turns, or on
     engine-initiated turns Tavern does not ingest: `/retry`, `/queue`, and
     `/steer` return a `{type: "send"}` dispatch payload the engine's own
     client turns into a user turn (Tavern's composer queues and steers
     natively instead); `/background` runs work whose output never leaves
     the slash worker; `/goal` and `/subgoal` drive a judge loop that chains
     engine-initiated continuation turns invisible to the Tavern timeline.

   Apply the same tests to new engine commands before letting them through.

The suppression list is the one deliberate exception to "the catalog is
engine-owned": it names commands to hide, never commands to invent. Unknown
engine commands always pass through with the default treatment.

Engine descriptions are user-facing copy, so Runtime sanitizes them before
they reach the palette: the engine name and its install paths are rewritten
into agent-first language ("Hermes" → "the agent", "Hermes Agent" → "agent
engine", `~/.hermes/skills/` → "the agent's skills directory"), per the
product-language boundary in Coding Rule 11.

## Execution

A submitted message whose trimmed content is `/name [args]` for a known
catalog command executes as a command instead of starting a chat turn:

1. The app calls `agent.runCommand` with the agent id, chat id, and the raw
   command text.
2. The server proxies to Runtime `POST /commands/run`.
3. Bare `/model` opens app-side model completion before Runtime is called. When
   the user picks a model, the app submits `/model <provider/model>` through
   the same command path.
4. Runtime derives the chat's canonical channel session key and uses the same
   long-lived Hermes client used by normal chat turns. Runtime opens or resumes
   the chat-bound live engine session and executes the command through the
   gateway. `/model <provider/model>` is the Tavern/App canonical ref form;
   Runtime translates it to the engine's native `model --provider provider`
   argument and uses `config.set` with `key: "model"` so the next turn sees the
   same session model as the engine client. Other default engine commands use
   `slash.exec` first; when the engine rejects with its use-`command.dispatch`
   error, Runtime retries via `command.dispatch`. ANSI escape sequences are
   stripped from the output.
5. Runtime records the run as durable chat evidence: a completed (or failed)
   response holding one `command` activity row with the typed command under
   `metadata.command` and the output as the detail. Evidence is written after
   the run settles so the timeline never shows an in-flight command turn.
6. The app's chat log shapes that activity into a standalone
   `system / commandRun` row, rendered as a low-contrast surface card with
   the command name and collapsible monospace output. Failures use the error
   tone. The only toast is the failure case where the command could not run
   at all.

Unknown leading-slash text falls through and sends as a normal message.
Command execution mutates live session state only through the engine's own
command semantics. Tavern does not parse or reimplement individual commands,
with `/new`, `/clear`, and `/status` as the binding-aware exceptions.

### /new, /clear, and /status

`/new` and `/clear` rotate the Hermes session bound to this chat participant:
Runtime closes the live engine session when one is open and drops the synced
session mapping, so the chat's next message opens a brand-new engine session
under the same Tavern session key. The engine's own `/new` handler is
deliberately not used unless Runtime can observe the new Hermes session id and
atomically update the binding; otherwise the fresh context can silently diverge
from the session normal chat turns use.

`/new` stops there: fresh context, timeline untouched.

`/clear` additionally soft-deletes every message and response currently in
the chat (`POST /api/chats/{id}/clear`, one `chat.cleared` event). The reset
runs first: a failed session reset never hides history. The clear itself
lands as a command card after the wipe — the only row left in the timeline —
and new work appears normally. History stays durable; rows keep their
sequence slots, and the old engine session remains stored execution evidence
in both cases.

`/status` reports the binding Runtime will use for the next chat turn. It must
not create, resume, or rotate an engine session just to inspect status.

## Dismissal

Command cards and failed-turn banners carry a dismiss control (an X shown on
hover). Dismissing soft-deletes the row's response in Runtime
(`DELETE /api/responses/{id}`), so the row disappears from the timeline on
every client and stays gone across reloads, while the durable record is
retained. The app removes the row optimistically and reconciles on the next
log refetch; other clients converge through the `chat.historyChanged` runtime
event. Live failure banners (those not yet backed by a durable response id)
have no dismiss control until the durable refetch fills the id in.

## Contract

- Command runs are durable chat evidence, keyed like any response: the card
  survives reloads and offline catch-up (unless dismissed).
- The catalog is engine-owned. Tavern never invents command names; the only
  Tavern-side edits are the suppression list, the `/new`, `/clear`, and
  `/status` remaps, and the description sanitization above.
- Command execution requires the `gateway` capability and an existing chat.
- User-facing copy presents these as the assistant's commands.
- Dismissal and `/clear` ride the chat API's soft-delete contract; they never
  hard-delete history.

## Future Work

- Support skill-invocation commands by running the engine's built invocation
  message as a normal turn.
- Argument hints from the engine's subcommand metadata.
- Standing goals (`/goal`) as a proper Tavern feature. Requires
  engine-initiated turn ingestion: a persistent per-session listener that
  projects turns Runtime did not start into durable responses, plus approval
  routing for mid-goal tool approvals. Until then the engine's goal loop runs
  off-screen, so the commands stay suppressed.
