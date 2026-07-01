import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { getChat } from '../tavern/chat-api/index.ts';
import { runRuntimeDoctor } from './runtime-doctor.ts';

describe('Runtime Doctor', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('repairs missing built-in Agent DMs from the agents module', async () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_research',
                isAdmin: false,
                name: 'Research',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-research-workspace',
            },
        });
        getDb()
            .prepare('DELETE FROM chat_participants WHERE chat_id = $chatId')
            .run(namedParams({ chatId: 'cht_agt_research_dm' }));
        getDb()
            .prepare('DELETE FROM chats WHERE id = $chatId')
            .run(namedParams({ chatId: 'cht_agt_research_dm' }));

        const result = await runRuntimeDoctor({
            modules: ['agents'],
            reason: 'manual_check',
        });

        expect(getChat('cht_agt_research_dm')).toMatchObject({
            id: 'cht_agt_research_dm',
            kind: 'dm',
            participants: [
                { id: 'agt_research', kind: 'agent', label: 'Research' },
                { id: 'usr_tavern', kind: 'user', label: 'You' },
            ],
            title: 'Research',
        });
        expect(result[0]?.repaired).toEqual(
            expect.arrayContaining([
                {
                    id: 'cht_agt_research_dm',
                    kind: 'chat',
                    summary: 'Created built-in DM for Research.',
                },
            ])
        );
    });
});
