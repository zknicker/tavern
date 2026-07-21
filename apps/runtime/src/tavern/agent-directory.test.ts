import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { readAgentServerInfo } from './agent-directory.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat } from './chat-api/index.ts';

describe('agent server info roster', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-directory-');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: '/tmp/otto',
            },
            db: getDb(),
        });
    });
    afterEach(async () => await closeAgentApiTestDb(root));

    it('collapses human seats sharing one observed handle into one roster row', () => {
        // The operator's keyless seat and identity seat both surface as "You".
        createChat(
            {
                id: 'cht_one',
                participants: [
                    { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                    { id: 'usr_clerk1', kind: 'user', label: 'You', metadata: {} },
                    { id: 'agt_otto', kind: 'agent', label: 'Otto', metadata: {} },
                ],
                title: 'general',
            },
            getDb()
        );

        const info = readAgentServerInfo('agt_otto', { humans: true }, getDb());
        expect(info.humans).toEqual([{ description: null, handle: 'You' }]);
        expect(info.total.humans).toBe(1);
    });

    it('lists one row per handle even when distinct seats share the label', () => {
        // The roster is a handle directory, not a participant census: two
        // seats observed as "Sam" are one addressable handle. Targeting it
        // still fails closed as ambiguous at action time (D2).
        createChat(
            {
                id: 'cht_shared',
                participants: [
                    { id: 'usr_a', kind: 'user', label: 'Sam', metadata: {} },
                    { id: 'usr_b', kind: 'user', label: 'sam', metadata: {} },
                ],
                title: 'shared',
            },
            getDb()
        );

        const info = readAgentServerInfo('agt_otto', { humans: true }, getDb());
        // "you" rides along from Otto's bootstrapped DM (operator seat).
        expect(info.humans.map((row) => row.handle.toLowerCase())).toEqual(['sam', 'you']);
    });

    it('keeps distinct human handles as distinct rows', () => {
        createChat(
            {
                id: 'cht_two',
                participants: [
                    { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                    { id: 'usr_demo', kind: 'user', label: 'Sam', metadata: {} },
                ],
                title: 'demos',
            },
            getDb()
        );

        const info = readAgentServerInfo('agt_otto', { humans: true }, getDb());
        expect(info.humans.map((row) => row.handle)).toEqual(['Sam', 'You']);
    });
});
