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

## OpenClaw Development

OpenClaw-specific development recipes live here:

| Workflow | Doc |
| --- | --- |
| Tavern OpenClaw plugin lifecycle | [openclaw-plugin-deploy.md](openclaw-plugin-deploy.md) |
| Managed OpenClaw runtime upgrade | [openclaw-runtime-upgrade.md](openclaw-runtime-upgrade.md) |

## Verification

Use [Testing](testing.md) for test lanes and e2e rules.
