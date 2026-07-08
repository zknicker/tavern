# Workspace

Tavern owns the local workspace it creates for Tavern agents.

The workspace is the trusted filesystem home used by local tools and harness
processes for one Agent:

```text
.tavern/agents/<agent-id>/workspace
```

Sandbox mode `none` runs child processes directly from this workspace. This is
working-directory organization, not security isolation.

Child processes may receive a workspace-local process home for harnesses that
need CLI OAuth state. Runtime may seed credential files into that home, but it
must not copy broad host configuration into the workspace. The agent workspace
is local runtime state and must not be committed.

## Managed Files

- **`NOTES.md`** carries editable user notes for the Agent.
- **`SOUL.md`** carries identity, voice, tone, and durable personality.
- **`workbench/`** is the Agent's seeded working directory. Files produced
  while working belong under it: dispatched task work under
  `workbench/tasks/<T-number>/`, ad-hoc work organized however the Agent
  likes. It is scratch space: deliverables that must outlive it are
  promoted elsewhere (tracked work promotes them to task attachments), and
  the Agent may reorganize or clean it freely. Managed instructions teach
  this convention. Keeping the rest of the workspace text-light keeps
  workspaces cheap to back up.
- Generated instruction context is composed by Runtime from Agent settings,
  enabled skills, tools, Memory context, and Tavern product guidance.

Runtime may seed bootstrapped files for the primary Agent. After that, user
authored files should remain user-editable.

## Skills

Runtime owns the skill catalog and enablement state. Skill search/import tools
may read external sources, but Tavern stores the resulting skill as a Tavern
skill record and composes it into Agent instructions through Runtime.
