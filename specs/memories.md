# Memories

Memory in Tavern is assistant hot memory plus the Vault wiki.

Assistant hot memory lives in the engine's native `MEMORY.md` and `USER.md`
files and enters prompt context as a bounded snapshot. Durable inspectable
knowledge lives in the Vault wiki. Tavern Runtime exposes the wiki through the
Vault API and Vault tab, but it does not own a separate memory database.

Managed Tavern Hermes does not use Lossless Claw. Prompt-time context is
separate from durable wiki knowledge.

## Durable Knowledge

Vault files hold source-backed notes, project knowledge, research, and outputs
as plain Markdown. Agents use the managed `vault` skill to create and maintain
those files.

Tavern does not add a parallel `memory_records` table for normal memory. If a
user corrects compact hot memory, an agent updates `MEMORY.md` or `USER.md`
through the memory tool. If the correction affects durable knowledge, an agent
edits the relevant wiki page. If a user forgets something, an agent archives,
rewrites, or deletes the relevant memory entry or wiki material.

## Memory Inspection

Memory settings show assistant-memory configuration and Vault readiness where
needed. The Vault page is the browsable wiki surface. The Workspace page is the
browsable managed agent workspace.

The inspection model favors readable Markdown over graph visualization,
embedding settings, hidden repair queues, or generated schema controls.

## Person Memory

Person knowledge uses Tavern participants for identity, then stores durable
facts in wiki pages when an agent intentionally writes them.

Observed participant labels remain source evidence. Tavern does not merge
people by display name, and wiki facts should cite the participant source when
identity matters.

## Prompt Continuity

Prompt-facing context is rendered from live state and selected source material.
It can include stable identity context, assistant memory, recent activity,
participant context, Hermes prompt-time context, and relevant wiki pages.

The prompt view remains bounded. It must not become a dump of every wiki page or
every recent search result.

## Constraints

* Memory must not cause one agent's context to bleed into another agent.
* Person context must not leak into unrelated participants.
* Prompt context must stay bounded.
* Durable knowledge remains inspectable as Markdown.
* Hermes context management and wiki readiness remain separate signals.
