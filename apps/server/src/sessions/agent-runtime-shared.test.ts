import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRuntimeSession } from '@tavern/api';
import {
    type AgentRuntimeSessionSnapshot,
    buildAgentRuntimeSessionListItem,
    listAgentRuntimeSessionMessages,
} from './agent-runtime-shared.ts';

test('buildAgentRuntimeSessionListItem uses the stored Tavern chat name', () => {
    const session: AgentRuntimeSession = {
        agentId: 'claw',
        chatId: 'tavern:chat-1',
        key: 'session:abc123',
        lastActivityAt: '2026-04-17T18:00:05.000Z',
        messageCount: 4,
        parentSessionKey: null,
        platform: 'tavern',
        sessionId: 'claude-session-1',
        sessionRole: 'main',
        startedAt: '2026-04-17T18:00:00.000Z',
        title: 'Hey!',
    };

    const item = buildAgentRuntimeSessionListItem(
        session,
        new Map([['tavern:chat-1', 'portal:chat']])
    );

    assert.equal(item.name, 'portal:chat');
    assert.equal(item.source, 'portal:chat');
    assert.equal(item.type, 'portal');
});

test('buildAgentRuntimeSessionListItem keeps external chat names for non-Tavern sessions', () => {
    const session: AgentRuntimeSession = {
        agentId: 'claw',
        chatId: 'discord:channel:123',
        key: 'agent:claw:discord:channel:123',
        lastActivityAt: '2026-04-17T18:00:05.000Z',
        messageCount: 4,
        parentSessionKey: null,
        platform: 'discord',
        sessionId: 'discord-session-123',
        sessionRole: 'main',
        startedAt: '2026-04-17T18:00:00.000Z',
        title: '#general',
    };

    const item = buildAgentRuntimeSessionListItem(
        session,
        new Map([['discord:channel:123', '#general']])
    );

    assert.equal(item.name, '#general');
    assert.equal(item.source, '#general');
    assert.equal(item.type, 'chat');
});

test('listAgentRuntimeSessionMessages renders message ids without content-time filtering', () => {
    const targetSession: AgentRuntimeSession = {
        agentId: 'claw',
        chatId: 'tavern:chat-1',
        key: 'session:abc123',
        lastActivityAt: '2026-04-17T18:00:05.000Z',
        messageCount: 6,
        parentSessionKey: null,
        platform: 'tavern',
        sessionId: 'claude-session-1',
        sessionRole: 'main',
        startedAt: '2026-04-17T18:00:00.000Z',
        title: 'portal:chat',
    };

    const snapshot = {
        agentsById: new Map([['claw', 'Claw']]),
        chatTitlesById: new Map([['tavern:chat-1', 'portal:chat']]),
        graph: {
            artifacts: [],
            links: [],
            messages: [
                {
                    agentId: null,
                    chatId: targetSession.chatId,
                    content: 'how are you?',
                    id: 'msg_1',
                    metadata: null,
                    sender: 'main',
                    senderName: 'main',
                    senderType: 'user',
                    sessionKey: targetSession.key,
                    timestamp: '2026-04-17T18:00:01.000Z',
                },
                {
                    agentId: null,
                    chatId: targetSession.chatId,
                    content: 'how are you?',
                    id: 'transcript-user-1',
                    metadata: null,
                    sender: 'User',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: targetSession.key,
                    timestamp: '2026-04-17T18:00:01.900Z',
                },
                {
                    agentId: 'claw',
                    chatId: targetSession.chatId,
                    content: 'existing. thriving.',
                    id: 'msg_1:block:000',
                    metadata: {
                        model: 'claude-opus-4-6',
                        provider: 'claude',
                    },
                    sender: 'claw',
                    senderName: 'Claw',
                    senderType: 'agent',
                    sessionKey: targetSession.key,
                    timestamp: '2026-04-17T18:00:03.000Z',
                },
                {
                    agentId: 'claw',
                    chatId: targetSession.chatId,
                    content: 'existing. thriving.',
                    id: 'transcript-assistant-1',
                    metadata: {
                        model: 'claude-opus-4-6',
                        provider: 'claude',
                    },
                    sender: 'claw',
                    senderName: 'Claw',
                    senderType: 'agent',
                    sessionKey: targetSession.key,
                    timestamp: '2026-04-17T18:00:03.050Z',
                },
            ],
            rootSessionKey: targetSession.key,
            sessions: [targetSession],
            toolCalls: [],
        },
        sessions: [targetSession],
        sessionsByKey: new Map([[targetSession.key, targetSession]]),
        targetSession,
    } satisfies AgentRuntimeSessionSnapshot;

    const messages = listAgentRuntimeSessionMessages(snapshot);

    assert.deepEqual(
        messages.map((message) => ({
            content: message.content,
            id: message.id,
            senderType: message.senderType,
        })),
        [
            {
                content: 'how are you?',
                id: 'msg_1',
                senderType: 'user',
            },
            {
                content: 'how are you?',
                id: 'transcript-user-1',
                senderType: 'user',
            },
            {
                content: 'existing. thriving.',
                id: 'msg_1:block:000',
                senderType: 'agent',
            },
            {
                content: 'existing. thriving.',
                id: 'transcript-assistant-1',
                senderType: 'agent',
            },
        ]
    );
});
