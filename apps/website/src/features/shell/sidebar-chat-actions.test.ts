import { describe, expect, it } from 'vitest';
import {
    canCustomizeSidebarChatColor,
    canEditSidebarChatSystemPrompt,
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

    it('normalizes system prompt input before saving', () => {
        expect(normalizeSidebarChatSystemPrompt('  Keep replies concise.  ')).toBe(
            'Keep replies concise.'
        );
        expect(normalizeSidebarChatSystemPrompt('   ')).toBeNull();
    });
});
