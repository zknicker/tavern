---
summary: Local development workflow for managed dev stack startup, OpenClaw-specific recipes, and verification pointers.
read_when:
  - running Tavern locally or changing managed runtime development workflow
  - changing local stack startup, ports, or developer verification
---

# Development

## Local Stack

Run the full managed development stack:

```bash
bun run dev
```

This starts Tavern Runtime, managed OpenClaw Gateway, the local app backend, and
the website dev server.

When Runtime mode is active, the dev stack watches first-party Tavern OpenClaw
plugin packages. Editing those packages rebuilds the plugins, restarts Runtime,
and lets Runtime sync the changed plugin sources before managed OpenClaw loads
them.

## Shutdown

From the terminal, stop the dev stack with `Ctrl+C` or `kill -TERM <dev-stack-pid>`.
The stack sends `SIGTERM` to managed child processes and waits for each one to
exit before returning control to the shell. Runtime owns managed OpenClaw
shutdown, so the Runtime process logs while it waits for the Gateway to exit.

In desktop mode, quitting the app with `Cmd+Q` also lets the stack unwind. The
desktop process exits first, then the website, app backend, Runtime, and managed
OpenClaw Gateway stop.

## OpenClaw Development

OpenClaw-specific development recipes live here:

| Workflow | Doc |
| --- | --- |
| Tavern OpenClaw plugin lifecycle | [openclaw-plugin-deploy.md](openclaw-plugin-deploy.md) |
| Managed OpenClaw runtime upgrade | [openclaw-runtime-upgrade.md](openclaw-runtime-upgrade.md) |

## Verification

Use [Testing](testing.md) for test lanes and e2e rules.
