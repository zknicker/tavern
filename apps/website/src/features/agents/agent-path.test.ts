import { describe, expect, test } from 'bun:test';
import { buildAgentPath, buildAgentSettingsPath, getActiveAgentPage } from './agent-path.ts';

describe('agent page paths', () => {
    test('keeps agent chat entrypoints on the sessions settings page', () => {
        expect(buildAgentPath('atlas')).toBe('/settings/sessions');
    });

    test('builds agent settings paths', () => {
        expect(buildAgentSettingsPath('atlas')).toBe('/settings/agents/atlas/general');
        expect(buildAgentSettingsPath('atlas', 'memory')).toBe('/settings/agents/atlas/memory');
        expect(buildAgentSettingsPath()).toBe('/settings/agent');
    });

    test('does not parse retired agent-owned pages', () => {
        expect(getActiveAgentPage('/agent')).toBeNull();
        expect(getActiveAgentPage('/agent/chats')).toBeNull();
    });

    test('parses active agent settings pages', () => {
        expect(getActiveAgentPage('/settings/agents/atlas/general')).toEqual({
            agentId: 'atlas',
            tab: 'general',
        });
    });

    test('rejects unsupported agent pages', () => {
        expect(getActiveAgentPage('/agents/atlas')).toBeNull();
        expect(getActiveAgentPage('/agent/memory')).toBeNull();
        expect(getActiveAgentPage('/settings/agents/atlas/tools')).toBeNull();
        expect(getActiveAgentPage('/settings/agents/atlas/mcp')).toBeNull();
        expect(getActiveAgentPage('/overview')).toBeNull();
    });
});
