import { expect, test } from 'vitest';
import { isMentionEditorLineBreakShortcut } from './mention-editor.tsx';

test('mention editor inserts a line break for Cmd+Enter', () => {
    expect(
        isMentionEditorLineBreakShortcut({ isComposing: false, key: 'Enter', metaKey: true })
    ).toBe(true);
    expect(
        isMentionEditorLineBreakShortcut({ isComposing: true, key: 'Enter', metaKey: true })
    ).toBe(false);
    expect(
        isMentionEditorLineBreakShortcut({ isComposing: false, key: 'Enter', metaKey: false })
    ).toBe(false);
});
