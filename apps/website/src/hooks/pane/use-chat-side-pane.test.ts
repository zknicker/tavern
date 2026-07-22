import { afterEach, expect, test } from 'bun:test';
import {
    closeThreadPane,
    openThreadPane,
    resetThreadPanesForTest,
} from '../threads/use-thread-pane.ts';
import {
    closeAgentProfilePane,
    closeAgentProfilePanesForAgent,
    openAgentProfilePane,
    resetAgentProfilePanesForTest,
} from './use-agent-profile-pane.ts';
import {
    getChatSidePane,
    resetChatSidePanesForTest,
    setChatSidePane,
} from './use-chat-side-pane.ts';

afterEach(() => {
    resetAgentProfilePanesForTest();
    resetThreadPanesForTest();
    resetChatSidePanesForTest();
});

test('the most recently opened chat side pane wins', () => {
    setChatSidePane('chat-1', 'artifact');
    openThreadPane('chat-1', { anchorMessageId: 'msg_1', threadChatId: null });
    expect(getChatSidePane('chat-1')).toBe('thread');

    setChatSidePane('chat-1', 'artifact');
    expect(getChatSidePane('chat-1')).toBe('artifact');

    openAgentProfilePane('chat-1', 'agent-1');
    expect(getChatSidePane('chat-1')).toBe('profile');

    openThreadPane('chat-1', { anchorMessageId: 'msg_2', threadChatId: null });
    expect(getChatSidePane('chat-1')).toBe('thread');
});

test('closing the active profile restores artifacts without stealing from a thread', () => {
    openAgentProfilePane('chat-1', 'agent-1');
    closeAgentProfilePane('chat-1');
    expect(getChatSidePane('chat-1')).toBe('artifact');

    openAgentProfilePane('chat-1', 'agent-1');
    openThreadPane('chat-1', { anchorMessageId: 'msg_1', threadChatId: null });
    closeAgentProfilePane('chat-1');
    expect(getChatSidePane('chat-1')).toBe('thread');
});

test('closing a thread restores the artifact pane for that chat only', () => {
    openThreadPane('chat-1', { anchorMessageId: 'msg_1', threadChatId: 'cht_thr_1' });
    openThreadPane('chat-2', { anchorMessageId: 'msg_2', threadChatId: 'cht_thr_2' });

    closeThreadPane('chat-1');

    expect(getChatSidePane('chat-1')).toBe('artifact');
    expect(getChatSidePane('chat-2')).toBe('thread');
});

test('deleting an agent restores artifacts without stealing from a thread', () => {
    openAgentProfilePane('chat-1', 'agent-1');
    openAgentProfilePane('chat-2', 'agent-1');
    openThreadPane('chat-2', { anchorMessageId: 'msg_1', threadChatId: null });

    closeAgentProfilePanesForAgent('agent-1');

    expect(getChatSidePane('chat-1')).toBe('artifact');
    expect(getChatSidePane('chat-2')).toBe('thread');
});
