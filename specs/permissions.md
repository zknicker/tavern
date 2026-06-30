# Tool Access

Tavern does not expose interactive tool approval prompts.

Tool access is configured through static Tool grants and sandbox mode:

- enabled tools are auto-approved
- disabled tools are unavailable to the Agent
- sandbox mode controls the execution environment

The first sandbox mode is `none`, a trusted local workspace. It is not a
security boundary.

Future sandbox modes can add Docker or Podman when Runtime has tested providers.
