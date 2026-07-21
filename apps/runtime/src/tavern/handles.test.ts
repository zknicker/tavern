import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat } from './chat-api/index.ts';
import { isValidHandle, reservedHandles } from './handles.ts';

describe('Grotto handles', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-handles-');
    });
    afterEach(async () => await closeAgentApiTestDb(root));

    it('validates the grammar and every reserved handle case-insensitively', () => {
        expect(isValidHandle('Otto_2')).toBe(true);
        expect(isValidHandle('two words')).toBe(false);
        expect(isValidHandle('-leading')).toBe(false);
        expect(isValidHandle('x'.repeat(33))).toBe(false);
        for (const handle of reservedHandles) {
            expect(isValidHandle(handle)).toBe(false);
            expect(isValidHandle(handle.toUpperCase())).toBe(false);
        }
    });

    it('enforces case-insensitive participant uniqueness on create and update', () => {
        seedAgent('agt_otto', 'Otto');
        expect(() => seedAgent('agt_other', 'OTTO')).toThrow('already in use');
        seedAgent('agt_wren', 'Wren');
        expect(() => seedAgent('agt_wren', 'otto')).toThrow('already in use');
        expect(() => seedAgent('agt_reserved', 'Everyone')).toThrow('reserved');
    });

    it('shares participant handle uniqueness with stored humans', () => {
        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO identity_users
                 (id, clerk_user_id, name, email, avatar_url, created_at, updated_at)
                 VALUES ('usr_zach', 'clerk_zach', 'Zach', NULL, NULL, $now, $now)`
            )
            .run({ $now: now });
        expect(() => seedAgent('agt_zach', 'zach')).toThrow('already in use');
    });

    it('enforces channel handles on create and rename', () => {
        expect(() => createChat({ id: 'cht_missing', kind: 'channel' })).toThrow(
            'Channel handle is required'
        );
        createChat({ id: 'cht_general', kind: 'channel', title: 'General' });
        expect(() => createChat({ id: 'cht_other', kind: 'channel', title: 'general' })).toThrow(
            'already in use'
        );
        createChat({ id: 'cht_ops', kind: 'channel', title: 'ops' });
        expect(() => createChat({ id: 'cht_ops', title: 'GENERAL' })).toThrow('already in use');
        expect(() => createChat({ id: 'cht_bad', kind: 'channel', title: 'all' })).toThrow(
            'reserved'
        );
    });

    it('fails closed when legacy channel rows collide', async () => {
        seedAgent('agt_otto', 'Otto');
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [agentParticipant()],
            title: 'General',
        });
        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO chats
                 (id, kind, title, pinned, metadata_json, created_at, updated_at, last_message_sequence)
                 VALUES ('cht_legacy', 'channel', 'general', 0, '{}', $now, $now, 0)`
            )
            .run({ $now: now });
        const { resolveAgentTarget } = await import('./agent-targets.ts');
        expect(() => resolveAgentTarget({ agentId: 'agt_otto', target: '#general' })).toThrow(
            'not found'
        );
    });
});

function seedAgent(id: string, name: string) {
    return upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id,
            isAdmin: false,
            name,
            primaryColor: null,
            workspaceFolder: `/tmp/${id}`,
        },
    });
}

function agentParticipant() {
    return {
        id: 'agt_otto',
        kind: 'agent' as const,
        label: 'Otto',
        metadata: { agentId: 'agt_otto' },
    };
}
