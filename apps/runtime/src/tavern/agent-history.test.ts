import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { readAgentHistory, searchAgentMessages } from './agent-history.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage } from './chat-api/index.ts';

describe('agent message search', () => {
    let root: string;

    beforeEach(() => {
        root = initAgentApiTestDb('grotto-agent-search-');
        seedAgent('agt_otto', 'Otto');
        seedAgent('agt_wren', 'Wren');
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [agent('agt_otto', 'Otto')],
            title: 'general',
        });
        createChat({
            id: 'cht_dm',
            kind: 'dm',
            participants: [agent('agt_otto', 'Otto'), agent('agt_wren', 'Wren')],
            title: 'Otto and Wren',
        });
        createChat({
            id: 'cht_task',
            kind: 'task',
            participants: [agent('agt_otto', 'Otto')],
            title: 'Internal task',
        });
        createMessage('cht_general', {
            author_id: 'agt_otto',
            content: 'needle in channel',
            id: 'msg_10000000000000000000000000000000',
            role: 'assistant',
        });
        createMessage('cht_dm', {
            author_id: 'agt_wren',
            content: 'needle in dm',
            id: 'msg_20000000000000000000000000000000',
            role: 'assistant',
        });
        createMessage('cht_task', {
            author_id: 'agt_otto',
            content: 'needle in task',
            id: 'msg_30000000000000000000000000000000',
            role: 'assistant',
        });
    });

    afterEach(async () => await closeAgentApiTestDb(root));

    it('adds canonical targets and excludes chats outside the target grammar', () => {
        const result = searchAgentMessages('agt_otto', { q: 'needle', sort: 'recent' });

        expect(result.messages.map(({ id, target }) => ({ id, target }))).toEqual([
            { id: 'msg_20000000000000000000000000000000', target: 'dm:@Wren' },
            { id: 'msg_10000000000000000000000000000000', target: '#general' },
        ]);
        expect(
            searchAgentMessages('agt_otto', { limit: 1, q: 'needle', sort: 'recent' }).messages
        ).toMatchObject([{ id: 'msg_20000000000000000000000000000000', target: 'dm:@Wren' }]);
    });

    it('renders a DM target from the calling agent’s perspective', () => {
        const result = searchAgentMessages('agt_wren', { q: 'needle', target: 'dm:@Otto' });

        expect(result.messages).toMatchObject([{ target: 'dm:@Otto' }]);
    });
});

describe('agent history paging', () => {
    let root: string;

    beforeEach(() => {
        root = initAgentApiTestDb('grotto-agent-history-');
        seedAgent('agt_otto', 'Otto');
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [agent('agt_otto', 'Otto')],
            title: 'general',
        });
        for (let index = 1; index <= 5; index += 1) {
            createMessage('cht_general', {
                author_id: 'agt_otto',
                content: `update ${index}`,
                id: `msg_a000000000000000000000000000000${index}`,
                role: 'assistant',
            });
        }
    });

    afterEach(async () => {
        await closeAgentApiTestDb(root);
    });

    it('returns the newest page by default, oldest first within the page', () => {
        const page = readAgentHistory('agt_otto', { limit: 2, target: '#general' });
        expect(page.messages.map((message) => message.sequence)).toEqual([4, 5]);
        expect(page.has_older).toBe(true);
        expect(page.has_newer).toBe(false);
    });

    it('pages backward with --before and forward with --after', () => {
        const older = readAgentHistory('agt_otto', { before: '4', limit: 2, target: '#general' });
        expect(older.messages.map((message) => message.sequence)).toEqual([2, 3]);

        const newer = readAgentHistory('agt_otto', { after: '3', limit: 2, target: '#general' });
        expect(newer.messages.map((message) => message.sequence)).toEqual([4, 5]);
    });
});

function seedAgent(id: string, name: string): void {
    upsertStoredAgent({
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

function agent(id: string, label: string) {
    return { id, kind: 'agent' as const, label, metadata: { agentId: id } };
}
