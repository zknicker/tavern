import { describe, expect, test } from 'vitest';
import { shouldShowMainTopDragFade } from './main-top-drag-fade.ts';

describe('shouldShowMainTopDragFade', () => {
    test('enables the fade for chat scroll surfaces', () => {
        expect(shouldShowMainTopDragFade('/chats/chat-1')).toBe(true);
        expect(shouldShowMainTopDragFade('/chats/new')).toBe(true);
    });

    test('disables the fade for fixed app pages', () => {
        expect(shouldShowMainTopDragFade('/wiki')).toBe(false);
        expect(shouldShowMainTopDragFade('/tasks')).toBe(false);
        expect(shouldShowMainTopDragFade('/overview')).toBe(false);
        expect(shouldShowMainTopDragFade('/settings')).toBe(false);
    });
});
