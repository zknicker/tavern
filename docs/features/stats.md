---
summary: Stats feature for model/provider usage, spend signals, runtime health, and slow, failed, or expensive work clues.
read_when:
  - changing usage, spend, provider activity, or runtime health views
  - changing operational stats surfaced to users
---

# Stats

Stats turn runtime and provider activity into something users can scan.

## In the box

* **Connected sources.** Show stats only for Hermes providers that are connected
  and have a Tavern-supported stats source.
* **Usage.** Show Codex limits and OpenRouter account activity when those
  providers are connected.
* **Spend.** Surface cost signals where providers expose them. OpenRouter spend
  requires an account management key because the inference API key is not enough
  to read account activity.
* **Runtime health.** Show whether the agent runtime is connected and working.
* **Operational clues.** Help users understand slow, failed, or expensive work.
