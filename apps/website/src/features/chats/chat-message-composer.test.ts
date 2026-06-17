import { expect, test } from 'bun:test';
import { getComposerPrimaryAction } from './chat-message-composer.tsx';

test('composer replaces submit with stop only for empty active turns', () => {
    expect(
        getComposerPrimaryAction({
            activeRunId: 'run-1',
            hasDraftPayload: false,
            isReplyActive: true,
        })
    ).toBe('stop');

    expect(
        getComposerPrimaryAction({
            activeRunId: 'run-1',
            hasDraftPayload: true,
            isReplyActive: true,
        })
    ).toBe('submit');

    expect(
        getComposerPrimaryAction({
            activeRunId: 'run-1',
            hasDraftPayload: false,
            isReplyActive: false,
        })
    ).toBe('submit');

    expect(
        getComposerPrimaryAction({
            activeRunId: null,
            hasDraftPayload: false,
            isReplyActive: true,
        })
    ).toBe('submit');
});
