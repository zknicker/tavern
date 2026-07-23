import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import type { AgentApiError } from './agent-api-errors.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { leaveAgentChannel } from './agent-channels.ts';
import { reactToAgentMessage } from './agent-reactions.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage } from './chat-api/index.ts';

describe('agent reaction visibility', () => {
    let root: string;

    beforeEach(() => {
        root = initAgentApiTestDb('tavern-agent-reactions-');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_one',
                isAdmin: false,
                name: 'One',
                primaryColor: null,
                workspaceFolder: root,
            },
        });
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [
                { id: 'agt_one', kind: 'agent', label: 'One', metadata: { agentId: 'agt_one' } },
            ],
            title: 'general',
        });
        createMessage('cht_general', {
            author_id: 'usr_tavern',
            content: 'before leave',
            id: 'msg_10000000000000000000000000000001',
            role: 'user',
        });
    });

    afterEach(async () => await closeAgentApiTestDb(root));

    it('rejects reactions after the agent leaves the chat', () => {
        leaveAgentChannel('agt_one', { target: '#general' });

        expect(() =>
            reactToAgentMessage('agt_one', {
                emoji: '👍',
                messageId: 'msg_10000000000000000000000000000001',
            })
        ).toThrow(expect.objectContaining<Partial<AgentApiError>>({ code: 'NOT_A_MEMBER' }));
        expect(
            getDb().prepare('SELECT COUNT(*) AS count FROM message_reactions').get()
        ).toMatchObject({ count: 0 });
    });
});
