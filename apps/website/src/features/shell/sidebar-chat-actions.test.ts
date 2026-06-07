import { describe, expect, it } from 'vitest';
import {
    canEditSidebarChatSystemPrompt,
    normalizeSidebarChatSystemPrompt,
} from './sidebar-chat-actions.tsx';

describe('sidebar chat actions', () => {
    it('allows system prompt edits only for pinned Tavern chats', () => {
        expect(canEditSidebarChatSystemPrompt({ isPinned: true, type: 'tavern' })).toBe(true);
        expect(canEditSidebarChatSystemPrompt({ isPinned: false, type: 'tavern' })).toBe(false);
        expect(canEditSidebarChatSystemPrompt({ isPinned: true, type: 'discord' })).toBe(false);
    });

    it('normalizes system prompt input before saving', () => {
        expect(normalizeSidebarChatSystemPrompt('  Keep replies concise.  ')).toBe(
            'Keep replies concise.'
        );
        expect(normalizeSidebarChatSystemPrompt('   ')).toBeNull();
    });
});
