import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { readAgentDraft, saveAgentDraft } from './agent-drafts.ts';
import { readAgentHistory } from './agent-history.ts';
import { sendAgentMessage } from './agent-send.ts';
import { ensureCurrentAgentSession, startNewAgentSession } from './agent-session-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, listMessages } from './chat-api/index.ts';
import { readSeenCursor } from './seen-ledger.ts';
import { readServedCursor } from './served-ledger.ts';

describe('agent attested sends', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-agent-send-');
        seedAgent('agt_otto', 'Otto');
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [human(), agent('agt_otto', 'Otto')],
            title: 'general',
        });
    });
    afterEach(async () => await closeAgentApiTestDb(root));

    it('holds, replaces, releases, and eventually allows an unchanged draft anyway', () => {
        peerMessage('msg_00000000000000000000000000000001', '@Otto first update');
        const first = sendAgentMessage('agt_otto', { content: 'first draft', target: '#general' });
        expect(first).toMatchObject({
            formalMentionCount: 1,
            reholdCount: 1,
            state: 'held',
        });

        peerMessage('msg_00000000000000000000000000000002', 'second update');
        const replaced = sendAgentMessage('agt_otto', {
            content: 'replacement draft',
            target: '#general',
        });
        expect(replaced).toMatchObject({
            continueAnywaySuggested: true,
            reholdCount: 2,
            state: 'held',
        });
        expect(readAgentDraft('agt_otto', 'cht_general')?.content).toBe('replacement draft');

        const released = sendAgentMessage('agt_otto', { sendDraft: true, target: '#general' });
        expect(released).toMatchObject({
            message: { content: 'replacement draft' },
            state: 'sent',
        });
        expect(readAgentDraft('agt_otto', 'cht_general')).toBeNull();

        peerMessage('msg_00000000000000000000000000000004', 'third update');
        expect(
            sendAgentMessage('agt_otto', { content: 'unchanged draft', target: '#general' })
        ).toMatchObject({ reholdCount: 1, state: 'held' });
        peerMessage('msg_00000000000000000000000000000005', 'fourth update');
        expect(sendAgentMessage('agt_otto', { sendDraft: true, target: '#general' })).toMatchObject(
            {
                continueAnywaySuggested: true,
                reholdCount: 2,
                state: 'held',
            }
        );
        peerMessage('msg_00000000000000000000000000000006', 'fifth update');
        expect(
            sendAgentMessage('agt_otto', {
                continueAnyway: true,
                sendDraft: true,
                target: '#general',
            })
        ).toMatchObject({ message: { content: 'unchanged draft' }, state: 'sent' });
    });

    it('expires drafts lazily after ten minutes', () => {
        const savedAt = new Date('2026-07-21T12:00:00.000Z');
        saveAgentDraft({
            agentId: 'agt_otto',
            attachmentIds: [],
            chatId: 'cht_general',
            content: 'expired',
            now: savedAt,
            reholdCount: 1,
        });
        expect(
            readAgentDraft('agt_otto', 'cht_general', {
                now: new Date(savedAt.getTime() + 10 * 60 * 1000),
            })
        ).toBeNull();
    });

    it('uses served only for the pull-then-send race and holds a later arrival', () => {
        peerMessage('msg_10000000000000000000000000000001', 'pulled');
        const history = readAgentHistory('agt_otto', { target: '#general' });
        expect(history.messages).toHaveLength(1);

        const sent = sendAgentMessage('agt_otto', { content: 'after pull', target: '#general' });
        expect(sent.state).toBe('sent');

        peerMessage('msg_10000000000000000000000000000003', 'arrived after pull');
        const held = sendAgentMessage('agt_otto', { content: 'too late', target: '#general' });
        expect(held).toMatchObject({ newMessageCount: 1, state: 'held' });
    });

    it('advances seen and served through rows displayed by a hold', () => {
        peerMessage('msg_20000000000000000000000000000001', 'one');
        peerMessage('msg_20000000000000000000000000000002', 'two');
        const held = sendAgentMessage('agt_otto', { content: 'draft', target: '#general' });
        expect(held.state).toBe('held');
        const session = ensureCurrentAgentSession({ agentId: 'agt_otto' });
        expect(readSeenCursor(session.id, 'cht_general')).toBe(2);
        expect(readServedCursor(session.id, 'cht_general')).toBe(2);
    });

    it('starts a fresh served horizon per session so resets cannot bypass holds', () => {
        peerMessage('msg_30000000000000000000000000000001', 'before reset');
        expect(sendAgentMessage('agt_otto', { content: 'draft', target: '#general' }).state).toBe(
            'held'
        );

        startNewAgentSession({ agentId: 'agt_otto' });
        expect(
            sendAgentMessage('agt_otto', { content: 'after reset', target: '#general' }).state
        ).toBe('held');
    });

    it('bounds hold display to the latest twelve peer rows and reports omissions', () => {
        for (let index = 1; index <= 13; index += 1) {
            peerMessage(`msg_${index.toString(16).padStart(32, '0')}`, `update ${index}`);
        }
        const held = sendAgentMessage('agt_otto', { content: 'draft', target: '#general' });
        expect(held).toMatchObject({
            newMessageCount: 13,
            omittedMessageCount: 1,
            state: 'held',
        });
        if (held.state !== 'held') {
            throw new Error('Expected a held send.');
        }
        expect(held.shownMessages).toHaveLength(12);
        expect(held.shownMessages[0]?.content).toBe('update 2');
    });

    it('skips the freshness gate for DMs', () => {
        seedAgent('agt_wren', 'Wren');
        const sent = sendAgentMessage('agt_otto', { content: 'hello', target: 'dm:@Wren' });
        expect(sent.state).toBe('sent');
    });

    it('reports unseen rows from other targets on a fresh send and acks them', () => {
        createChat({
            id: 'cht_ops',
            kind: 'channel',
            participants: [human(), agent('agt_otto', 'Otto')],
            title: 'ops',
        });
        createMessage('cht_ops', {
            author_id: 'usr_tavern',
            content: 'deploy finished',
            id: 'msg_00000000000000000000000000000011',
            role: 'user',
        });
        const sent = sendAgentMessage('agt_otto', { content: 'hello', target: '#general' });
        if (sent.state !== 'sent') {
            throw new Error('Expected a fresh send to commit.');
        }
        expect(sent.recentUnread).toHaveLength(1);
        expect(sent.recentUnread[0]).toMatchObject({
            message: { content: 'deploy finished' },
            target: '#ops',
        });
        const session = ensureCurrentAgentSession({ agentId: 'agt_otto' });
        expect(readSeenCursor(session.id, 'cht_ops')).toBeGreaterThan(0);
        expect(readServedCursor(session.id, 'cht_ops')).toBeGreaterThan(0);
        const followUp = sendAgentMessage('agt_otto', { content: 'on it', target: '#ops' });
        expect(followUp.state).toBe('sent');
    });

    it('deduplicates sends by nonce', () => {
        const first = sendAgentMessage('agt_otto', {
            compositionId: 'cmp_1',
            content: 'once',
            nonce: 'stable-nonce',
            target: '#general',
        });
        const second = sendAgentMessage('agt_otto', {
            content: 'once',
            nonce: 'stable-nonce',
            target: '#general',
        });
        if (first.state !== 'sent') {
            throw new Error('Expected first send to commit.');
        }
        expect(first.message.id).toMatch(/^msg_[a-f0-9]{32}$/u);
        expect(first.message.metadata).toMatchObject({ compositionId: 'cmp_1' });
        expect(second).toMatchObject({ message: { id: first.message.id }, state: 'sent' });
        expect(listMessages('cht_general').messages).toHaveLength(1);

        // A retry stays idempotent even when peer traffic arrived after the
        // original commit — the gate must not hold a same-nonce resend.
        peerMessage('msg_00000000000000000000000000000021', 'landed between retries');
        const retried = sendAgentMessage('agt_otto', {
            content: 'once',
            nonce: 'stable-nonce',
            target: '#general',
        });
        expect(retried).toMatchObject({ message: { id: first.message.id }, state: 'sent' });
        expect(listMessages('cht_general').messages).toHaveLength(2);
    });
});

function seedAgent(id: string, name: string) {
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

function peerMessage(id: string, content: string) {
    createMessage('cht_general', { author_id: 'usr_tavern', content, id, role: 'user' });
}

function human() {
    return { id: 'usr_tavern', kind: 'user' as const, label: 'Zach', metadata: {} };
}

function agent(id: string, label: string) {
    return { id, kind: 'agent' as const, label, metadata: { agentId: id } };
}
