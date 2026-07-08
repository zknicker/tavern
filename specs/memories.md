# Memories

Memory is Tavern's per-agent durable context surface. Wiki is Tavern's shared
Markdown knowledge surface.

Wiki is inspectable Markdown-backed knowledge. It can be edited and browsed
through the Wiki UI and read by Runtime during prompt composition.

Prompt-time context is separate from durable knowledge. Runtime may render
bounded context from stable identity, recent activity, participant context,
Agent instructions, and relevant Wiki pages.

## Rules

- Durable knowledge remains inspectable.
- Prompt context stays bounded.
- Memory and Wiki readiness are Runtime capabilities.
- Tools may write Memory or Wiki only through Runtime-owned APIs.
