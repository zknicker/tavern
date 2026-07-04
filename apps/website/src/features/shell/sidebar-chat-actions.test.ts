import { describe, expect, it } from 'vitest';
import {
    canCustomizeSidebarChatColor,
    canEditSidebarChatParticipants,
    canEditSidebarChatSystemPrompt,
    canRenameSidebarChat,
    normalizeSidebarChatSystemPrompt,
} from './sidebar-chat-actions.tsx';

describe('sidebar chat actions', () => {
    it('allows channel color for Tavern channels', () => {
        expect(canCustomizeSidebarChatColor({ conversationKind: 'channel', type: 'tavern' })).toBe(
            true
        );
        expect(canCustomizeSidebarChatColor({ conversationKind: 'direct', type: 'tavern' })).toBe(
            false
        );
        expect(canCustomizeSidebarChatColor({ conversationKind: 'channel', type: 'discord' })).toBe(
            false
        );
    });

    it('allows instructions for Tavern chats', () => {
        expect(canEditSidebarChatSystemPrompt({ type: 'tavern' })).toBe(true);
        expect(canEditSidebarChatSystemPrompt({ type: 'discord' })).toBe(false);
    });

    it('allows participant edits for Tavern channels', () => {
        expect(
            canEditSidebarChatParticipants({ conversationKind: 'channel', type: 'tavern' })
        ).toBe(true);
        expect(canEditSidebarChatParticipants({ conversationKind: 'direct', type: 'tavern' })).toBe(
            false
        );
        expect(
            canEditSidebarChatParticipants({ conversationKind: 'channel', type: 'discord' })
        ).toBe(false);
    });

    it('allows renaming chats with one or more bound agents', () => {
        expect(canRenameSidebarChat({ boundAgentIds: ['agent-1'] })).toBe(true);
        expect(canRenameSidebarChat({ boundAgentIds: ['agent-1', 'agent-2'] })).toBe(true);
        expect(canRenameSidebarChat({ boundAgentIds: [] })).toBe(false);
    });

    it('normalizes system prompt input before saving', () => {
        expect(normalizeSidebarChatSystemPrompt('  Keep replies concise.  ')).toBe(
            'Keep replies concise.'
        );
        expect(normalizeSidebarChatSystemPrompt('   ')).toBeNull();
    });
});
