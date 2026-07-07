import assert from 'node:assert/strict';
import test from 'node:test';
import {
    agentSettingsNavItems,
    resolveAgentSettingsNavOpen,
    settingsNavItems,
} from './navigation.ts';

test('settings navigation uses current agent configuration vocabulary', () => {
    const labels: string[] = settingsNavItems.map((item) => item.label);
    const agentLabels: string[] = agentSettingsNavItems.map((item) => item.label);

    assert.deepEqual(agentLabels, ['General', 'Skills & Plugins', 'Channels']);
    assert.ok(labels.includes('Memory'));
    assert.ok(!labels.includes('Tools'));
    assert.ok(labels.includes('Channels'));
    assert.ok(!labels.includes('MCP'));
    assert.ok(!labels.includes('Agent'));
    assert.ok(!labels.includes('NOTES.md'));
    assert.ok(!labels.includes('SOUL.md'));
    assert.ok(!labels.includes('Toolsets'));
    assert.ok(!labels.includes('Connectors'));
    assert.ok(!labels.includes('McpServers'));
});

test('agent settings nav can be manually collapsed while the agent route is active', () => {
    assert.equal(
        resolveAgentSettingsNavOpen({
            isAgentActive: true,
            manualOpen: null,
        }),
        true
    );
    assert.equal(
        resolveAgentSettingsNavOpen({
            isAgentActive: true,
            manualOpen: false,
        }),
        false
    );
    assert.equal(
        resolveAgentSettingsNavOpen({
            isAgentActive: false,
            manualOpen: true,
        }),
        true
    );
});
