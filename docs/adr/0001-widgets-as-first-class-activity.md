---
summary: Decision to store Tavern Widgets as first-class widget response activity.
read_when:
  - changing Widget persistence, replay, response activity kinds, or widget row projection
---

# Widgets are first-class response activity

Tavern stores agent-rendered Widgets as `widget` response activity instead of hiding them inside
generic `custom` activity metadata. This makes Widget rendering part of the durable chat contract,
keeps Server projection straightforward, and avoids requiring future agents to know a hidden
metadata convention.
