import { describe, expect, test } from 'bun:test';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import type { ChatListItem } from '../chats/chat-list-data.ts';
import { canRenameSidebarChat } from './sidebar-chat-actions.tsx';
import {
    buildSidebarChatGroups,
    buildSidebarChatList,
    buildSidebarDraftChatList,
    formatSidebarActivityLabel,
    getSidebarChatTitle,
    getSidebarDraftActivityLabel,
    getSidebarDraftPath,
    hasLocalActiveTurn,
    isSidebarTavernChat,
} from './sidebar-chat-list.tsx';

function createChat(overrides: Partial<ChatListItem> = {}): ChatListItem {
    return {
        agentRuntimeSync: null,
        agentRuntimeSyncLabel: null,
        boundAgentIds: ['agent-1'],
        canSend: true,
        conversationKind: 'group',
        createdAt: '2026-05-01T12:00:00.000Z',
        displayName: 'Tavern chat',
        framework: 'tavern',
        hasActiveTurn: false,
        hasActivity: true,
        id: 'chat-1',
        isDisabled: false,
        isEnabled: true,
        isPinned: false,
        lastActivityAt: '2026-05-06T12:00:00.000Z',
        lastActivityLabel: 'now',
        latestSession: {
            agentId: 'agent-1',
            sessionId: null,
            lastActivityAt: '2026-05-06T12:00:00.000Z',
            platform: 'tavern',
            sessionKey: 'session-1',
            title: null,
        },
        participants: [],
        scope: null,
        searchText: 'tavern chat',
        sessionCount: 1,
        source: { kind: 'tavern', label: 'Tavern' },
        systemPrompt: null,
        tabAppearance: { color: null },
        targetParticipant: null,
        title: 'Tavern chat',
        type: 'tavern',
        ...overrides,
    };
}

function createDraft(overrides: Partial<ChatStartDraft> = {}): ChatStartDraft {
    return {
        agentId: 'agent-1',
        clientMessageId: 'msg_1',
        content: 'Hello',
        createdAt: '2026-05-13T12:00:00.000Z',
        errorMessage: null,
        id: 'tavern-draft-chat:1',
        realAcceptedAt: null,
        realChatId: null,
        realRunId: null,
        realSessionKey: null,
        status: 'queued',
        title: 'Hello',
        ...overrides,
    };
}

describe('sidebar chat list', () => {
    test('keeps only Tavern-initiated chats', () => {
        expect(isSidebarTavernChat(createChat())).toBeTrue();
        expect(isSidebarTavernChat(createChat({ framework: 'agentRuntime' }))).toBeFalse();
        expect(isSidebarTavernChat(createChat({ type: 'discord' }))).toBeFalse();
    });

    test('keeps recent Tavern chats in list order', () => {
        const chats = [
            createChat({ id: 'discord', framework: 'agentRuntime', type: 'discord' }),
            createChat({ id: 'tavern' }),
        ];

        expect(buildSidebarChatList(chats)).toEqual([chats[1]]);
    });

    test('groups pinned chats separately from recent chats', () => {
        const pinned = createChat({ id: 'pinned', isPinned: true });
        const recent = createChat({ id: 'recent' });
        const groups = buildSidebarChatGroups([pinned, recent]);

        expect(groups.pinnedChats).toEqual([pinned]);
        expect(groups.recentChats).toEqual([recent]);
        expect(groups.allChats).toEqual([pinned, recent]);
    });

    test('keeps draft chats visible until their synced chat appears', () => {
        const pendingDraft = createDraft({ id: 'tavern-draft-chat:pending' });
        const reconciledDraft = createDraft({
            id: 'tavern-draft-chat:reconciled',
            realChatId: 'chat-1',
            status: 'reconciled',
        });

        expect(buildSidebarDraftChatList([pendingDraft, reconciledDraft], [])).toEqual([
            pendingDraft,
            reconciledDraft,
        ]);
        expect(buildSidebarDraftChatList([pendingDraft, reconciledDraft], [createChat()])).toEqual([
            pendingDraft,
        ]);
    });

    test('links pending drafts to the draft route and reconciled drafts to the real chat', () => {
        expect(getSidebarDraftPath(createDraft())).toBe('/dashboard/chats/new');
        expect(getSidebarDraftPath(createDraft({ realChatId: 'chat-1' }))).toBe(
            '/dashboard/chats/chat-1'
        );
    });

    test('labels draft chat activity by local state', () => {
        expect(getSidebarDraftActivityLabel(createDraft({ status: 'queued' }))).toBe('starting');
        expect(getSidebarDraftActivityLabel(createDraft({ status: 'creating' }))).toBe('starting');
        expect(getSidebarDraftActivityLabel(createDraft({ status: 'reconciled' }))).toBe(
            'just now'
        );
        expect(getSidebarDraftActivityLabel(createDraft({ status: 'error' }))).toBe('failed');
    });

    test('shortens sidebar activity labels', () => {
        expect(formatSidebarActivityLabel('33m ago')).toBe('33m');
        expect(formatSidebarActivityLabel('2h ago')).toBe('2h');
        expect(formatSidebarActivityLabel('just now')).toBe('just now');
        expect(formatSidebarActivityLabel('no activity yet')).toBe('no activity yet');
    });

    test('shows the chat name without the Tavern prefix', () => {
        expect(
            getSidebarChatTitle(
                createChat({
                    displayName: 'Hey Blippy!',
                    title: 'Tavern Hey Blippy!',
                })
            )
        ).toBe('Hey Blippy!');
    });

    test('uses explicit active turn state for local sidebar progress', () => {
        expect(hasLocalActiveTurn({ activeTurn: null })).toBeFalse();
        expect(
            hasLocalActiveTurn({
                activeTurn: {
                    agentId: 'agent-1',
                    chatId: 'chat-1',
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-06T12:00:00.000Z',
                },
            })
        ).toBeTrue();
    });

    test('renames only chats with one bound agent', () => {
        expect(canRenameSidebarChat(createChat({ boundAgentIds: ['agent-1'] }))).toBeTrue();
        expect(canRenameSidebarChat(createChat({ boundAgentIds: [] }))).toBeFalse();
        expect(
            canRenameSidebarChat(createChat({ boundAgentIds: ['agent-1', 'agent-2'] }))
        ).toBeFalse();
    });
});
