import { expect, test } from 'vitest';
import {
    type ChatComposerQueuedMessage,
    canStartQueuedSteer,
    hasPendingSteerAtQueueHead,
    isQueuedMessageSteerable,
    moveQueuedMessage,
    promoteQueuedMessage,
    removeQueuedMessage,
    removeStoredQueuedMessage,
    reorderVisibleQueuedMessages,
    restoreQueuedMessage,
    shouldInterruptActiveTurnForQueuedMessage,
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

test('removeQueuedMessage hides a queued message immediately', () => {
    expect(removeQueuedMessage(queue, 'queued_2').map((entry) => entry.id)).toEqual([
        'queued_1',
        'queued_3',
    ]);
});

test('restoreQueuedMessage puts a failed optimistic steer back in place', () => {
    const removed = removeQueuedMessage(queue, 'queued_2');
    const restored = restoreQueuedMessage(removed, queue[1]!, 1);

    expect(restored.map((entry) => entry.id)).toEqual(['queued_1', 'queued_2', 'queued_3']);
    expect(restoreQueuedMessage(restored, queue[1]!, 1)).toEqual(restored);
});

test('reorderVisibleQueuedMessages keeps hidden pending steer entries stored', () => {
    const reordered = reorderVisibleQueuedMessages(
        queue,
        [queue[2]!, queue[0]!],
        new Set(['queued_2'])
    );

    expect(reordered.map((entry) => entry.id)).toEqual(['queued_3', 'queued_2', 'queued_1']);
});

test('pending steer blocks queue dispatch only while it owns the stored head', () => {
    expect(hasPendingSteerAtQueueHead(queue, new Set(['queued_1']))).toBe(true);
    expect(hasPendingSteerAtQueueHead(queue, new Set(['queued_2']))).toBe(false);
    expect(hasPendingSteerAtQueueHead([], new Set(['queued_1']))).toBe(false);
});

test('pending steer blocks starting another queued steer', () => {
    expect(canStartQueuedSteer({ pendingSteerIds: new Set(), steerPending: false })).toBe(true);
    expect(
        canStartQueuedSteer({ pendingSteerIds: new Set(['queued_1']), steerPending: false })
    ).toBe(false);
    expect(canStartQueuedSteer({ pendingSteerIds: new Set(), steerPending: true })).toBe(false);
});

test('removeStoredQueuedMessage removes an accepted steer draft from storage', () => {
    const { localStorage, restore } = installWindowLocalStorage();

    try {
        localStorage.setItem('tavern.chat.composerQueue.v1:chat-1', JSON.stringify(queue));

        removeStoredQueuedMessage('chat-1', 'queued_2');

        expect(
            JSON.parse(localStorage.getItem('tavern.chat.composerQueue.v1:chat-1') ?? '[]').map(
                (entry: ChatComposerQueuedMessage) => entry.id
            )
        ).toEqual(['queued_1', 'queued_3']);
    } finally {
        restore();
    }
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
});

test('text-only queued messages do not interrupt when steering is closed', () => {
    expect(shouldInterruptActiveTurnForQueuedMessage(message('queued_text', 'send next'))).toBe(
        false
    );
    expect(
        shouldInterruptActiveTurnForQueuedMessage({
            ...message('queued_attachment', 'send now'),
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
    ).toBe(true);
});

function message(id: string, content: string): ChatComposerQueuedMessage {
    return {
        agentId: 'agt_main',
        content,
        createdAt: '2026-06-09T00:00:00.000Z',
        id,
    };
}

function installWindowLocalStorage() {
    const localStorage = createMemoryLocalStorage();
    const hadWindow = 'window' in globalThis;
    const previousWindow = (globalThis as { window?: unknown }).window;

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage },
        writable: true,
    });

    return {
        localStorage,
        restore: () => {
            if (hadWindow) {
                Object.defineProperty(globalThis, 'window', {
                    configurable: true,
                    value: previousWindow,
                    writable: true,
                });
                return;
            }

            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: undefined,
                writable: true,
            });
        },
    };
}

function createMemoryLocalStorage() {
    const values = new Map<string, string>();

    return {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => {
            values.delete(key);
        },
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
    };
}
