import { describe, expect, test } from 'bun:test';
import { buildAgentPath, buildAgentSettingsPath, getActiveAgentPage } from './agent-path.ts';

describe('agent page paths', () => {
    test('builds agent-owned paths to the sessions settings page', () => {
        expect(buildAgentPath('atlas')).toBe('/dashboard/settings/sessions');
        expect(buildAgentSettingsPath('atlas')).toBe('/dashboard/settings/sessions');
    });

    test('does not parse retired agent-owned pages', () => {
        expect(getActiveAgentPage('/dashboard/agent')).toBeNull();
        expect(getActiveAgentPage('/dashboard/agent/chats')).toBeNull();
    });

    test('rejects unsupported agent pages', () => {
        expect(getActiveAgentPage('/dashboard/agents/atlas')).toBeNull();
        expect(getActiveAgentPage('/dashboard/agent/memory')).toBeNull();
        expect(getActiveAgentPage('/dashboard/overview')).toBeNull();
    });
});
