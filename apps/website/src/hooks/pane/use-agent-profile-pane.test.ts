import { describe, expect, test } from 'vitest';
import { createAgentProfilePaneStore } from './use-agent-profile-pane.ts';

describe('agent profile pane store', () => {
    test('opens, swaps, and closes profiles', () => {
        const store = createAgentProfilePaneStore();

        store.open('chat-1', 'agent-1');
        expect(store.get('chat-1')).toBe('agent-1');

        store.open('chat-1', 'agent-2');
        expect(store.get('chat-1')).toBe('agent-2');

        store.close('chat-1');
        expect(store.get('chat-1')).toBeNull();
    });
});
