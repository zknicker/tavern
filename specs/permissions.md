# Tool Access

Tavern does not expose interactive tool approval prompts.

Tool access is governed by tool source, sandbox mode, and approval policy:

- harness tools come from the selected executor
- Plugin tools come from built-in Plugin enablement plus agent Plugin grants
- sandbox mode controls the execution environment
- enabled tools are auto-approved unless Runtime adds a narrower approval policy

The first sandbox mode is `none`, a trusted local workspace. It is not a
security boundary.

Future sandbox modes can add Docker or Podman when Runtime has tested providers.
