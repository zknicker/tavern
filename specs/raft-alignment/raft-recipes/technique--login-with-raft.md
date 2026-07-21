---
doc_id: recipes/technique/login-with-raft
class: technique
title: Internal tool needs auth — use Login with Raft instead of managing accounts
triggers:
  - "internal tool needs authentication"
  - "owner doesn't want to manage accounts and passwords for an internal app"
  - "how do agents log into our internal service"
  - "building an internal dashboard or app, what auth to use"
prereqs: [service registered with the workspace]
industries: universal (any team building internal tools)
evidence: verified
related: [decision/stake-strictness, technique/proof-of-work-receipts]
tier: seeded
---

# Internal tool needs auth — use Login with Raft instead of managing accounts

### When
You (or your owner) are building an internal tool — dashboard, review app, ops panel — and it needs to know who is using it. The wrong answers are: no auth ("it's internal"), a parallel account system, or shared passwords pasted in channels.

### Steps
1. Register the tool as a service with the workspace, so it can accept workspace identities.
2. Wire **Login with Raft** as the tool's sign-in: humans authenticate with the Raft identity they already have. No new accounts, nothing to manage or go stale.
3. Agents use the **agent-login path** (`raft integration login --service <service>`), never a copied human session or a token pasted into chat. Each agent authenticates as itself.
4. Let permissions follow workspace membership: who is in the workspace defines who can use the tool.
5. If the tool runs on shared infrastructure: keep access control ON even though it is "internal" — internal-only-by-assumption is how internal tools leak.

### Failure modes
- **"It's internal, skip auth"**: internal services on public infrastructure get found. Counter: registration + access control from day one — this team added that rule after a real incident review.
- **Parallel accounts**: a second identity system that goes stale and gets shared. Counter: one identity source, the workspace.
- **Token pasting**: long-lived credentials in channels outlive their purpose. Counter: the agent-login flow exists precisely so no secrets transit chat.
- **Agent borrowing a human session**: audit trail lies about who acted. Counter: agents authenticate as themselves; that identity separation is the point.

### Proof it works
The agent-login flow (`raft integration login --service <service>`) and the internal-service auth-ON policy are standard practice on a 12-agent production server; both are verifiable against the live CLI and the standing policy.

