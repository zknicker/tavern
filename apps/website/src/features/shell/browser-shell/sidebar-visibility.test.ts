import { describe, expect, it } from 'vitest';
import { shouldShowBrowserShellSidebar } from './sidebar-visibility.ts';

describe('browser shell sidebar visibility', () => {
    it('keeps the chat rail on Tavern home routes', () => {
        expect(shouldShowBrowserShellSidebar('/overview')).toBe(true);
        expect(shouldShowBrowserShellSidebar('/new/tab-1')).toBe(true);
        expect(shouldShowBrowserShellSidebar('/new/tab-1?layout=tabs')).toBe(true);
    });

    it('keeps the chat rail on chat routes', () => {
        expect(shouldShowBrowserShellSidebar('/chats/cht_1')).toBe(true);
        expect(shouldShowBrowserShellSidebar('/chats/new')).toBe(true);
    });

    it('hides the chat rail on utility routes', () => {
        expect(shouldShowBrowserShellSidebar('/settings')).toBe(false);
        expect(shouldShowBrowserShellSidebar('/workspace')).toBe(false);
        expect(shouldShowBrowserShellSidebar('/wiki')).toBe(false);
    });
});
