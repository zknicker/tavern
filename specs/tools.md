# Tools

Tools are Tavern's inline execution interactions.

## Product Expectations

- A tool interaction represents a tool invocation and its result as one understandable product
  interaction.
- A tool interaction is not just a raw message fragment.
- A tool interaction is not a worker.

## Relationships

- A tool interaction may appear in chat history, session history, or both.
- A tool interaction is invoked by an agent.
- A tool interaction may link to spawned sessions, workers, or related outputs.

## Presentation

- Tool interactions render as first-class rows, not duplicated invocation/result noise.
- The product makes tool name, status, and summary understandable without exposing raw tool
  protocol details.
