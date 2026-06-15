import { expect, test } from 'vitest';
import {
    type ChatComposerQueuedMessage,
    isQueuedMessageSteerable,
    moveQueuedMessage,
    promoteQueuedMessage,
} from './chat-composer-queue.ts';
import { getQueuedDragVisualIndex } from './chat-composer-queue-panel.tsx';

const queue = [
    message('queued_1', 'first'),
    message('queued_2', 'second'),
    message('queued_3', 'third'),
];

test('promoteQueuedMessage moves a queued message to the front', () => {
    expect(promoteQueuedMessage(queue, 'queued_3').map((entry) => entry.id)).toEqual([
        'queued_3',
        'queued_1',
        'queued_2',
    ]);
});

test('promoteQueuedMessage keeps the queue order when the message is already first', () => {
    expect(promoteQueuedMessage(queue, 'queued_1').map((entry) => entry.id)).toEqual([
        'queued_1',
        'queued_2',
        'queued_3',
    ]);
});

test('promoteQueuedMessage preserves queued composer payload fields', () => {
    const promoted = promoteQueuedMessage(
        [
            message('queued_1', 'first'),
            {
                ...message('queued_2', ''),
                attachments: [
                    {
                        dataBase64: 'aW1hZ2U=',
                        filename: 'image.png',
                        mediaType: 'image/png',
                        sizeBytes: 5,
                        type: 'inline',
                    },
                    {
                        dataBase64: 'cGRm',
                        filename: 'notes.pdf',
                        mediaType: 'application/pdf',
                        sizeBytes: 3,
                        type: 'inline',
                    },
                ],
                modelRef: 'openai/gpt-5',
            },
        ],
        'queued_2'
    );

    expect(promoted[0]).toMatchObject({
        attachments: [
            {
                filename: 'image.png',
                type: 'inline',
            },
            {
                filename: 'notes.pdf',
                type: 'inline',
            },
        ],
        id: 'queued_2',
        modelRef: 'openai/gpt-5',
    });
});

test('moveQueuedMessage reorders queued messages one slot at a time', () => {
    expect(moveQueuedMessage(queue, 'queued_2', 'up').map((entry) => entry.id)).toEqual([
        'queued_2',
        'queued_1',
        'queued_3',
    ]);
    expect(moveQueuedMessage(queue, 'queued_2', 'down').map((entry) => entry.id)).toEqual([
        'queued_1',
        'queued_3',
        'queued_2',
    ]);
});

test('queued drag visual index shifts displaced cards into open tiers', () => {
    expect(
        [0, 1, 2].map((index) =>
            getQueuedDragVisualIndex({
                dragStartIndex: 0,
                dragTargetIndex: 2,
                index,
            })
        )
    ).toEqual([0, 0, 1]);

    expect(
        [0, 1, 2].map((index) =>
            getQueuedDragVisualIndex({
                dragStartIndex: 2,
                dragTargetIndex: 0,
                index,
            })
        )
    ).toEqual([1, 2, 2]);
});

test('queued messages are steerable only when they can become text-only live input', () => {
    expect(isQueuedMessageSteerable(message('queued_text', 'nudge the current turn'))).toBe(true);
    expect(
        isQueuedMessageSteerable({
            ...message('queued_attachment', 'use this'),
            attachments: [
                {
                    dataBase64: 'aW1hZ2U=',
                    filename: 'image.png',
                    mediaType: 'image/png',
                    sizeBytes: 5,
                    type: 'inline',
                },
            ],
        })
    ).toBe(false);
    expect(
        isQueuedMessageSteerable({
            ...message('queued_model', 'use a different model'),
            modelRef: 'openai/gpt-5',
        })
    ).toBe(false);
});

function message(id: string, content: string): ChatComposerQueuedMessage {
    return {
        agentId: 'agt_main',
        content,
        createdAt: '2026-06-09T00:00:00.000Z',
        id,
    };
}
