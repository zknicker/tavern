import * as React from 'react';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';

const storagePrefix = 'tavern.chat.composerQueue.v1:';

export interface ChatComposerQueuedMessage {
    agentId: string;
    attachments?: ChatMessageAttachmentInput[];
    content: string;
    createdAt: string;
    id: string;
    metadata?: Record<string, unknown>;
}

export function useChatComposerQueue(chatId: string) {
    const [queue, setQueue] = React.useState<ChatComposerQueuedMessage[]>(() => loadQueue(chatId));

    React.useEffect(() => {
        setQueue(loadQueue(chatId));
    }, [chatId]);

    React.useEffect(() => {
        saveQueue(chatId, queue);
    }, [chatId, queue]);

    const enqueue = React.useCallback(
        (message: Omit<ChatComposerQueuedMessage, 'createdAt' | 'id'>) => {
            const entry: ChatComposerQueuedMessage = {
                ...message,
                createdAt: new Date().toISOString(),
                id: `queued_${crypto.randomUUID()}`,
            };
            setQueue((current) => [...current, entry]);
            return entry;
        },
        []
    );

    const remove = React.useCallback((id: string) => {
        setQueue((current) => removeQueuedMessage(current, id));
    }, []);

    const restore = React.useCallback((entry: ChatComposerQueuedMessage, index: number) => {
        setQueue((current) => restoreQueuedMessage(current, entry, index));
    }, []);

    const promote = React.useCallback((id: string) => {
        setQueue((current) => promoteQueuedMessage(current, id));
    }, []);

    const move = React.useCallback((id: string, direction: 'down' | 'up') => {
        setQueue((current) => moveQueuedMessage(current, id, direction));
    }, []);

    const reorder = React.useCallback((nextQueue: readonly ChatComposerQueuedMessage[]) => {
        setQueue([...nextQueue]);
    }, []);

    return {
        enqueue,
        move,
        promote,
        queue,
        reorder,
        remove,
        restore,
    };
}

export function removeQueuedMessage(
    queue: readonly ChatComposerQueuedMessage[],
    id: string
): ChatComposerQueuedMessage[] {
    return queue.filter((entry) => entry.id !== id);
}

export function removeStoredQueuedMessage(chatId: string, id: string) {
    saveQueue(chatId, removeQueuedMessage(loadQueue(chatId), id));
}

export function restoreQueuedMessage(
    queue: readonly ChatComposerQueuedMessage[],
    entry: ChatComposerQueuedMessage,
    index: number
): ChatComposerQueuedMessage[] {
    if (queue.some((queued) => queued.id === entry.id)) {
        return [...queue];
    }

    const boundedIndex = Math.max(0, Math.min(index, queue.length));
    return [...queue.slice(0, boundedIndex), entry, ...queue.slice(boundedIndex)];
}

export function promoteQueuedMessage(
    queue: readonly ChatComposerQueuedMessage[],
    id: string
): ChatComposerQueuedMessage[] {
    const index = queue.findIndex((entry) => entry.id === id);

    if (index <= 0) {
        return [...queue];
    }

    const entry = queue[index];

    if (!entry) {
        return [...queue];
    }

    return [entry, ...queue.slice(0, index), ...queue.slice(index + 1)];
}

export function moveQueuedMessage(
    queue: readonly ChatComposerQueuedMessage[],
    id: string,
    direction: 'down' | 'up'
): ChatComposerQueuedMessage[] {
    const index = queue.findIndex((entry) => entry.id === id);

    if (index < 0) {
        return [...queue];
    }

    const nextIndex = direction === 'up' ? index - 1 : index + 1;

    if (nextIndex < 0 || nextIndex >= queue.length) {
        return [...queue];
    }

    const next = [...queue];
    const entry = next[index];
    const target = next[nextIndex];

    if (!(entry && target)) {
        return [...queue];
    }

    next[index] = target;
    next[nextIndex] = entry;
    return next;
}

export function reorderVisibleQueuedMessages(
    currentQueue: readonly ChatComposerQueuedMessage[],
    nextVisibleQueue: readonly ChatComposerQueuedMessage[],
    hiddenIds: ReadonlySet<string>
): ChatComposerQueuedMessage[] {
    if (hiddenIds.size === 0) {
        return [...nextVisibleQueue];
    }

    const nextVisibleEntries = nextVisibleQueue.filter((entry) => !hiddenIds.has(entry.id));
    const nextQueue: ChatComposerQueuedMessage[] = [];
    let nextVisibleIndex = 0;

    for (const entry of currentQueue) {
        if (hiddenIds.has(entry.id)) {
            nextQueue.push(entry);
            continue;
        }

        const nextVisibleEntry = nextVisibleEntries[nextVisibleIndex];
        nextVisibleIndex += 1;

        if (nextVisibleEntry) {
            nextQueue.push(nextVisibleEntry);
        }
    }

    return [...nextQueue, ...nextVisibleEntries.slice(nextVisibleIndex)];
}

export function hasPendingSteerAtQueueHead(
    queue: readonly ChatComposerQueuedMessage[],
    pendingSteerIds: ReadonlySet<string>
) {
    const head = queue[0];
    return Boolean(head && pendingSteerIds.has(head.id));
}

export function canStartQueuedSteer(input: {
    pendingSteerIds: ReadonlySet<string>;
    steerPending: boolean;
}) {
    return !input.steerPending && input.pendingSteerIds.size === 0;
}

export function isQueuedMessageSteerable(entry: ChatComposerQueuedMessage) {
    return entry.content.trim().length > 0 && !entry.attachments?.length;
}

export function shouldInterruptActiveTurnForQueuedMessage(entry: ChatComposerQueuedMessage) {
    return !isQueuedMessageSteerable(entry);
}

function loadQueue(chatId: string): ChatComposerQueuedMessage[] {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey(chatId)) ?? '[]');
        return Array.isArray(parsed) ? parsed.flatMap(parseQueuedMessage) : [];
    } catch {
        return [];
    }
}

function saveQueue(chatId: string, queue: readonly ChatComposerQueuedMessage[]) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (queue.length === 0) {
            window.localStorage.removeItem(storageKey(chatId));
            return;
        }

        window.localStorage.setItem(storageKey(chatId), JSON.stringify(queue));
    } catch {
        // Best-effort only. The in-memory queue still works for this app session.
    }
}

function storageKey(chatId: string) {
    return `${storagePrefix}${chatId}`;
}

function parseQueuedMessage(value: unknown): ChatComposerQueuedMessage[] {
    if (!(value && typeof value === 'object')) {
        return [];
    }

    const row = value as Record<string, unknown>;

    if (
        typeof row.agentId !== 'string' ||
        typeof row.content !== 'string' ||
        typeof row.createdAt !== 'string' ||
        typeof row.id !== 'string'
    ) {
        return [];
    }

    const metadata =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : undefined;
    const attachments = parseAttachments(row.attachments);
    return [
        {
            agentId: row.agentId,
            ...(attachments.length > 0 ? { attachments } : {}),
            content: row.content,
            createdAt: row.createdAt,
            id: row.id,
            ...(metadata ? { metadata } : {}),
        },
    ];
}

function parseAttachments(value: unknown): ChatMessageAttachmentInput[] {
    if (Array.isArray(value)) {
        return value.flatMap((entry) => {
            const attachment = parseAttachment(entry);
            return attachment ? [attachment] : [];
        });
    }

    const legacyAttachment = parseAttachment(value);
    return legacyAttachment ? [legacyAttachment] : [];
}

function parseAttachment(value: unknown): ChatMessageAttachmentInput | undefined {
    if (!(value && typeof value === 'object')) {
        return undefined;
    }

    const row = value as Record<string, unknown>;

    if (
        row.type === 'inline' &&
        typeof row.dataBase64 === 'string' &&
        typeof row.filename === 'string' &&
        typeof row.mediaType === 'string' &&
        typeof row.sizeBytes === 'number'
    ) {
        return {
            dataBase64: row.dataBase64,
            filename: row.filename,
            mediaType: row.mediaType,
            sizeBytes: row.sizeBytes,
            type: 'inline',
        };
    }

    if (row.type === 'file' && typeof row.filename === 'string' && typeof row.path === 'string') {
        return {
            filename: row.filename,
            path: row.path,
            type: 'file',
        };
    }

    return undefined;
}
