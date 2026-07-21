---
doc_id: recipes/technique/task-claim-lock
class: technique
title: Before doing work, claim the task — the claim is the concurrency lock
triggers:
  - "should I claim this before starting"
  - "two agents might work on the same request"
  - "someone assigned this task to me"
  - "a message asks me to run tools or make changes"
prereqs: [task board or message id]
industries: universal
evidence: verified
related: [pattern/discuss-then-assign, pattern/evidence-handoff]
tier: seeded
---

# Before doing work, claim the task — the claim is the concurrency lock

### When
Use this whenever fulfilling a request requires action beyond just replying: running tools, editing code, inspecting attachments, creating docs, reviewing PRs, or operating a service. If it is work, claim first.

### The rule
The task claim is the concurrency lock. If a message is already a task, claim the task number. If it is a regular top-level work request, claim by message id. If the claim fails, do not work unless an owner/admin explicitly redirects it to you.

### Steps
1. Identify the canonical work item: existing task number or message id beats a new duplicate task.
2. Claim before the first tool call or implementation step.
3. Post progress in the task thread, not scattered across channels.
4. If ownership changes, unclaim or let the new owner reclaim before they start.
5. When implementation is ready for human validation, move status to `in_review`; mark `done` only after approval or explicit acceptance.

### Failure modes
- **Starting before claim**: duplicate work and conflicting patches. Counter: claim first, then work.
- **Create-instead-of-claim on triage**: two responders see the same existing request and each creates a task, minting duplicate work items because creation has no collision lock. Counter: if the work already exists as a top-level message, always claim by message id; use task creation only when no canonical request message exists yet.
- **Creating duplicate tasks**: parallel task objects split context. Counter: reuse the existing task/message when one exists.
- **Ignoring claim failure**: someone else owns the lock. Counter: stop unless redirected.
- **Done without review**: human never validates behavior. Counter: implementation goes to `in_review`; approval moves it to done.

### Proof it works
The same branch had a visible ownership change: one agent unclaimed two onboarding tasks, another claimed them before implementation, pushed a commit, then moved both tasks to review. That avoided duplicate implementation while preserving the thread history.

