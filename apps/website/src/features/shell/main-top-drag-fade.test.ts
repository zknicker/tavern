import { describe, expect, test } from 'vitest';
import { shouldShowMainTopDragFade } from './main-top-drag-fade.ts';

describe('shouldShowMainTopDragFade', () => {
    test('enables the fade for chat scroll surfaces', () => {
        expect(shouldShowMainTopDragFade('/dashboard/chats/chat-1')).toBe(true);
        expect(shouldShowMainTopDragFade('/dashboard/chats/new')).toBe(true);
        expect(shouldShowMainTopDragFade('/dashboard/chat-layout-preview')).toBe(true);
    });

    test('disables the fade for fixed dashboard pages', () => {
        expect(shouldShowMainTopDragFade('/dashboard/cortex')).toBe(false);
        expect(shouldShowMainTopDragFade('/dashboard/cron')).toBe(false);
        expect(shouldShowMainTopDragFade('/dashboard/overview')).toBe(false);
        expect(shouldShowMainTopDragFade('/dashboard/settings')).toBe(false);
    });
});
