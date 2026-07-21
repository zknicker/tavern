import * as React from 'react';
import { buildChatList } from '../../features/chats/chat-list-data.ts';
import { isSidebarTavernChat } from '../../features/shell/sidebar-chat-list-model.ts';
import { useChatList } from '../chats/use-chat-list.ts';
import { useTaskList } from '../tasks/use-task-list.ts';
import { hasTasksUpdatedAfter, parseTasksLastSeenAt } from './rail-unseen-store.ts';

const tasksLastSeenAtStorageKey = 'tavern.tasks.lastSeenAt';
const listeners = new Set<() => void>();
let tasksLastSeenAt = readInitialTasksLastSeenAt();

export function useActivityUnseen() {
    const chatsQuery = useChatList();

    return React.useMemo(
        () =>
            buildChatList(chatsQuery.data).some(
                (chat) => isSidebarTavernChat(chat) && chat.unreadCount > 0
            ),
        [chatsQuery.data]
    );
}

export function useTasksUnseen() {
    const tasksQuery = useTaskList();
    const lastSeenAt = React.useSyncExternalStore(
        subscribeToTasksLastSeenAt,
        getTasksLastSeenAt,
        () => 0
    );

    return hasTasksUpdatedAfter(tasksQuery.data?.tasks ?? [], lastSeenAt);
}

export function markTasksSeen(seenAt = Date.now()) {
    tasksLastSeenAt = seenAt;
    window.localStorage.setItem(tasksLastSeenAtStorageKey, String(seenAt));

    for (const listener of listeners) {
        listener();
    }
}

function getTasksLastSeenAt() {
    return tasksLastSeenAt;
}

function subscribeToTasksLastSeenAt(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function readInitialTasksLastSeenAt() {
    if (typeof window === 'undefined') {
        return 0;
    }

    return parseTasksLastSeenAt(window.localStorage.getItem(tasksLastSeenAtStorageKey));
}
