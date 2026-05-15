import { describe, expect, test } from 'bun:test';
import { buildAgentPath, buildAgentSettingsPath, getActiveAgentPage } from './agent-path.ts';

describe('agent page paths', () => {
    test('builds agent-owned page paths with home as the default page', () => {
        expect(buildAgentPath('atlas')).toBe('/dashboard/agent');
        expect(buildAgentSettingsPath('atlas')).toBe('/dashboard/settings/agent');
    });

    test('parses active agent-owned pages from the route', () => {
        expect(getActiveAgentPage('/dashboard/agent')).toEqual({
            agentId: 'primary',
            page: 'home',
        });
        expect(getActiveAgentPage('/dashboard/agent/chats')).toBeNull();
    });

    test('rejects unsupported agent pages', () => {
        expect(getActiveAgentPage('/dashboard/agents/atlas')).toBeNull();
        expect(getActiveAgentPage('/dashboard/agent/memory')).toBeNull();
        expect(getActiveAgentPage('/dashboard/overview')).toBeNull();
    });
});
