import * as React from 'react';
import { buildChatList } from '../../features/chats/chat-list-data.ts';
import { isSidebarTavernChat } from '../../features/shell/sidebar-chat-list-model.ts';
import { useChatList } from '../chats/use-chat-list.ts';
import { useTaskList } from '../tasks/use-task-list.ts';
import {
    buildTaskSeenRevisions,
    hasUnseenTasks,
    parseTaskSeenRevisions,
    type TaskSeenRevision,
} from './rail-unseen-store.ts';

const taskSeenRevisionsStorageKey = 'tavern.tasks.seenRevisions';
const listeners = new Set<() => void>();
const emptyTaskSeenRevisions: TaskSeenRevision[] = [];
let taskSeenRevisions = readInitialTaskSeenRevisions();

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
    const seenRevisions = React.useSyncExternalStore(
        subscribeToTaskSeenRevisions,
        getTaskSeenRevisions,
        () => emptyTaskSeenRevisions
    );

    return hasUnseenTasks(tasksQuery.data?.tasks ?? [], seenRevisions);
}

export function markTasksSeen(tasks: readonly { id: string; updatedAt: string }[]) {
    taskSeenRevisions = buildTaskSeenRevisions(tasks);
    window.localStorage.setItem(taskSeenRevisionsStorageKey, JSON.stringify(taskSeenRevisions));

    for (const listener of listeners) {
        listener();
    }
}

function getTaskSeenRevisions() {
    return taskSeenRevisions;
}

function subscribeToTaskSeenRevisions(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function readInitialTaskSeenRevisions() {
    if (typeof window === 'undefined') {
        return emptyTaskSeenRevisions;
    }

    return parseTaskSeenRevisions(window.localStorage.getItem(taskSeenRevisionsStorageKey));
}
