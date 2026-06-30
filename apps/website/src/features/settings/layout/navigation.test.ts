import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsNavItems } from './navigation.ts';

test('settings navigation uses current agent configuration vocabulary', () => {
    const labels: string[] = settingsNavItems.map((item) => item.label);

    assert.ok(labels.includes('Tools'));
    assert.ok(labels.includes('Channels'));
    assert.ok(labels.includes('MCP'));
    assert.ok(!labels.includes('Toolsets'));
    assert.ok(!labels.includes('Connectors'));
    assert.ok(!labels.includes('McpServers'));
});
