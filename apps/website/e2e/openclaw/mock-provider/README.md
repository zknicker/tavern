# OpenClaw Mock Provider

This directory vendors the OpenClaw QA mock OpenAI-compatible provider from:

- repo: `https://github.com/openclaw/openclaw`
- tag: `v2026.5.7`
- source: `extensions/qa-lab/src/providers/mock-openai/server.ts`

Keep this copy aligned with the pinned `openclaw` dev dependency. When upgrading OpenClaw, refresh
`server.ts` from the matching tag and keep the local `close-http-server.ts` import.
