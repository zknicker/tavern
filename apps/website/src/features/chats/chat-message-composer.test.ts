import { expect, test } from 'bun:test';
import { getComposerPrimaryAction } from './chat-message-composer.tsx';

test('composer replaces submit with stop only for empty active turns', () => {
    expect(
        getComposerPrimaryAction({
            hasActiveRun: true,
            hasDraftPayload: false,
            isReplyActive: true,
        })
    ).toBe('stop');

    expect(
        getComposerPrimaryAction({
            hasActiveRun: true,
            hasDraftPayload: true,
            isReplyActive: true,
        })
    ).toBe('submit');

    expect(
        getComposerPrimaryAction({
            hasActiveRun: true,
            hasDraftPayload: false,
            isReplyActive: false,
        })
    ).toBe('submit');

    expect(
        getComposerPrimaryAction({
            hasActiveRun: false,
            hasDraftPayload: false,
            isReplyActive: true,
        })
    ).toBe('submit');
});
