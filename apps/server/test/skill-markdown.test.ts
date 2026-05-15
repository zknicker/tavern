import { test } from 'bun:test';
import assert from 'node:assert/strict';
import {
    buildSkillMarkdown,
    normalizeSkillMarkdown,
    parseSkillMarkdown,
    parseSkillMetadataYaml,
} from '../src/skills/markdown.ts';

test('parseSkillMarkdown returns frontmatter fields and body separately', () => {
    const parsed = parseSkillMarkdown({
        contentMarkdown: `---
name: planner
description: Use when planning work.
license: Apache-2.0
compatibility: Requires git
allowed-tools: Bash(git:*) Read
metadata:
  author: example-org
  requires:
    bins:
      - codex
  version: "1.0"
---

# Planner

Break work into steps.
`,
        skillId: 'planner',
    });

    assert.equal(parsed.name, 'planner');
    assert.equal(parsed.description, 'Use when planning work.');
    assert.equal(parsed.license, 'Apache-2.0');
    assert.equal(parsed.compatibility, 'Requires git');
    assert.equal(parsed.allowedTools, 'Bash(git:*) Read');
    assert.deepEqual(parsed.metadata, {
        author: 'example-org',
        requires: {
            bins: ['codex'],
        },
        version: '1.0',
    });
    assert.equal(
        parsed.metadataYaml,
        'author: example-org\nrequires:\n  bins:\n    - codex\nversion: "1.0"'
    );
    assert.equal(parsed.bodyMarkdown, '# Planner\n\nBreak work into steps.\n');
});

test('buildSkillMarkdown preserves unknown frontmatter while writing canonical YAML', () => {
    const built = buildSkillMarkdown({
        allowedTools: 'Bash(git:*) Read',
        bodyMarkdown: '# Updated\n\nNew instructions.\n',
        compatibility: 'Requires git',
        contentMarkdown: `---
name: planner
description: Old description
category: utilities
metadata:
  author: old-author
---

# Old
`,
        description: 'Use when updating plans.',
        license: 'Apache-2.0',
        metadata: {
            author: 'example-org',
            version: '1.0',
        },
        skillId: 'planner',
    });

    assert.match(built, /^---\nname: planner\ndescription: Use when updating plans\./m);
    assert.match(built, /license: Apache-2.0/);
    assert.match(built, /compatibility: Requires git/);
    assert.match(built, /allowed-tools: Bash\(git:\*\) Read/);
    assert.match(built, /category: utilities/);
    assert.match(built, /metadata:\n {2}author: example-org\n {2}version: "1.0"/);

    const parsed = parseSkillMarkdown({
        contentMarkdown: built,
        skillId: 'planner',
    });

    assert.equal(parsed.name, 'planner');
    assert.equal(parsed.description, 'Use when updating plans.');
    assert.equal(parsed.license, 'Apache-2.0');
    assert.equal(parsed.compatibility, 'Requires git');
    assert.equal(parsed.allowedTools, 'Bash(git:*) Read');
    assert.deepEqual(parsed.metadata, {
        author: 'example-org',
        version: '1.0',
    });
    assert.equal(parsed.bodyMarkdown, '# Updated\n\nNew instructions.\n');
});

test('parseSkillMarkdown handles CRLF frontmatter without leaking markers into description', () => {
    const parsed = parseSkillMarkdown({
        contentMarkdown:
            '---\r\nname: browser\r\ndescription: Browse the web for any task.\r\n---\r\n\r\n# Browser\r\n\r\nDo browser work.\r\n',
        skillId: 'browser',
    });

    assert.equal(parsed.name, 'browser');
    assert.equal(parsed.description, 'Browse the web for any task.');
    assert.equal(parsed.bodyMarkdown, '# Browser\n\nDo browser work.\n');
});

test('parseSkillMarkdown recovers malformed legacy body metadata', () => {
    const parsed = parseSkillMarkdown({
        contentMarkdown: `---
name: agent-browser
description: "---"
---

---

## name: agent-browser

description: Browse the web for any task.
allowed-tools: Bash(agent-browser:*)

# Browser Automation

Do browser work.
`,
        skillId: 'agent-browser',
    });

    assert.equal(parsed.name, 'agent-browser');
    assert.equal(parsed.description, 'Browse the web for any task.');
    assert.equal(parsed.allowedTools, 'Bash(agent-browser:*)');
    assert.equal(parsed.bodyMarkdown, '# Browser Automation\n\nDo browser work.\n');

    const rebuilt = buildSkillMarkdown({
        allowedTools: parsed.allowedTools,
        bodyMarkdown: parsed.bodyMarkdown,
        compatibility: parsed.compatibility,
        contentMarkdown: `---
name: agent-browser
description: "---"
---

---

## name: agent-browser

description: Browse the web for any task.
allowed-tools: Bash(agent-browser:*)

# Browser Automation

Do browser work.
`,
        description: parsed.description ?? '',
        license: parsed.license,
        metadata: parsed.metadata,
        skillId: 'agent-browser',
    });

    assert.match(rebuilt, /allowed-tools: Bash\(agent-browser:\*\)/);
    assert.doesNotMatch(rebuilt, /## name:/);
    assert.doesNotMatch(rebuilt, /description: "---"/);
});

test('normalizeSkillMarkdown rebuilds malformed legacy skill files into canonical frontmatter', () => {
    const normalized = normalizeSkillMarkdown({
        contentMarkdown: `---
name: agent-browser
description: "---"
---

---

## name: agent-browser

description: Browse the web for any task.
allowed-tools: Bash(agent-browser:*)

# Browser Automation

Do browser work.
`,
        skillId: 'agent-browser',
    });

    assert.equal(normalized.name, 'agent-browser');
    assert.equal(normalized.description, 'Browse the web for any task.');
    assert.equal(normalized.allowedTools, 'Bash(agent-browser:*)');
    assert.equal(normalized.bodyMarkdown, '# Browser Automation\n\nDo browser work.\n');
    assert.match(normalized.normalizedContentMarkdown, /^---\nname: agent-browser/m);
    assert.match(
        normalized.normalizedContentMarkdown,
        /description: Browse the web for any task\./
    );
    assert.match(normalized.normalizedContentMarkdown, /allowed-tools: Bash\(agent-browser:\*\)/);
    assert.doesNotMatch(normalized.normalizedContentMarkdown, /## name:/);
    assert.doesNotMatch(normalized.normalizedContentMarkdown, /description: "---"/);
});

test('parseSkillMetadataYaml requires a flat YAML map', () => {
    assert.deepEqual(parseSkillMetadataYaml('author: example-org\nversion: "1.0"'), {
        author: 'example-org',
        version: '1.0',
    });
    assert.equal(parseSkillMetadataYaml(''), null);
    assert.throws(
        () => parseSkillMetadataYaml('author:\n  team: tavern'),
        /Metadata YAML must only contain string, number, or boolean values/
    );
});
