import { describe, expect, test } from 'bun:test';
import { buildAgentPath, buildAgentSettingsPath, getActiveAgentPage } from './agent-path.ts';

describe('agent page paths', () => {
    test('builds agent-owned paths to the sessions settings page', () => {
        expect(buildAgentPath('atlas')).toBe('/settings/sessions');
        expect(buildAgentSettingsPath('atlas')).toBe('/settings/sessions');
    });

    test('does not parse retired agent-owned pages', () => {
        expect(getActiveAgentPage('/agent')).toBeNull();
        expect(getActiveAgentPage('/agent/chats')).toBeNull();
    });

    test('rejects unsupported agent pages', () => {
        expect(getActiveAgentPage('/agents/atlas')).toBeNull();
        expect(getActiveAgentPage('/agent/memory')).toBeNull();
        expect(getActiveAgentPage('/overview')).toBeNull();
    });
});
