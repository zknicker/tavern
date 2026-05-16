export type ChatTimingMarkName =
    | 'client.createChat'
    | 'client.failed'
    | 'client.invalidateChatList'
    | 'client.chatListRefreshFailed'
    | 'client.sendMessageDispatched'
    | 'client.startChat'
    | 'client.turnProgressEvent'
    | 'client.turnReplyUpdatedEvent'
    | 'client.turnStartedEvent'
    | 'draft.created'
    | 'draft.navigationDispatched'
    | 'final-message-visible'
    | 'optimistic-chat-visible'
    | 'optimistic-sidebar-visible'
    | 'optimistic-user-message-visible'
    | 'submit'
    | 'thinking-visible'
    | 'working-visible';

export interface ChatTimingEvent {
    fields: Record<string, string | number | boolean | null | undefined>;
    name: ChatTimingMarkName;
    timestamp: number;
    wallClockMs: number;
}

interface ChatTimingStore {
    enabled?: boolean;
    events?: ChatTimingEvent[];
    marks?: Partial<Record<ChatTimingMarkName, ChatTimingEvent>>;
}

declare global {
    interface Window {
        __TAVERN_CHAT_TIMING__?: ChatTimingStore;
    }
}

export function markChatTiming(
    name: ChatTimingMarkName,
    fields: Record<string, string | number | boolean | null | undefined> = {}
) {
    if (typeof window === 'undefined') {
        return;
    }

    const timing = window.__TAVERN_CHAT_TIMING__;

    if (!timing?.enabled) {
        return;
    }

    const event: ChatTimingEvent = {
        fields,
        name,
        timestamp: performance.now(),
        wallClockMs: Date.now(),
    };

    timing.events ??= [];
    timing.marks ??= {};
    timing.events.push(event);
    timing.marks[name] ??= event;

    try {
        performance.mark(`tavern.chat.${name}`);
    } catch {
        // Test timing should never affect product behavior.
    }
}

export function debugChatEvent(
    label: string,
    fields: Record<string, string | number | boolean | null | undefined> = {}
) {
    if (typeof window === 'undefined') {
        return;
    }

    const enabled =
        window.__TAVERN_CHAT_TIMING__?.enabled ||
        window.localStorage.getItem('tavern.chat.debug') === '1';

    if (!enabled) {
        return;
    }

    console.debug('[tavern:chat]', label, {
        ...fields,
        elapsedMs: Math.round(performance.now()),
        wallClockMs: Date.now(),
    });
}
