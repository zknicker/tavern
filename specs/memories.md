# Memories

Memory is Tavern's durable knowledge surface.

Memory is inspectable Markdown-backed knowledge. It can be edited and browsed
through the Memory UI and read by Runtime during prompt composition.

Prompt-time context is separate from durable knowledge. Runtime may render
bounded context from stable identity, recent activity, participant context,
Agent instructions, and relevant Memory pages.

## Rules

- Durable knowledge remains inspectable.
- Prompt context stays bounded.
- Memory readiness is a Runtime capability.
- Tools may write Memory only through Runtime-owned APIs.
