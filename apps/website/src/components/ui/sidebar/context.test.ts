import { describe, expect, test } from 'bun:test';
import { shouldToggleSidebarShortcut } from './context.tsx';

type ShortcutInput = Partial<Parameters<typeof shouldToggleSidebarShortcut>[0]>;

function shortcut(input: ShortcutInput) {
    return {
        altKey: false,
        ctrlKey: false,
        defaultPrevented: false,
        key: '',
        metaKey: false,
        shiftKey: false,
        target: null,
        ...input,
    };
}

describe('shouldToggleSidebarShortcut', () => {
    test('does not take the standard bold shortcut', () => {
        expect(shouldToggleSidebarShortcut(shortcut({ key: 'b', metaKey: true }))).toBe(false);
        expect(shouldToggleSidebarShortcut(shortcut({ ctrlKey: true, key: 'b' }))).toBe(false);
    });

    test('uses command-backslash for the app sidebar', () => {
        expect(shouldToggleSidebarShortcut(shortcut({ key: '\\', metaKey: true }))).toBe(true);
        expect(shouldToggleSidebarShortcut(shortcut({ ctrlKey: true, key: '\\' }))).toBe(true);
    });

    test('ignores modified or already-handled sidebar shortcuts', () => {
        expect(
            shouldToggleSidebarShortcut(shortcut({ key: '\\', metaKey: true, shiftKey: true }))
        ).toBe(false);
        expect(
            shouldToggleSidebarShortcut(
                shortcut({ defaultPrevented: true, key: '\\', metaKey: true })
            )
        ).toBe(false);
    });
});
