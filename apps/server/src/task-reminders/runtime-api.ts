import type { TavernChatMessage } from '@tavern/api';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import type {
    LabelRecord,
    ReminderRecord,
    ReminderRun,
    TaskListItem,
    TaskPriority,
    TaskStatus,
} from './contracts.ts';

async function runtimeClient() {
    const connection = await getActiveAgentRuntimeConnection();
    if (!(connection?.enabled && connection.baseUrl)) {
        throw new Error('Grotto Runtime is not connected.');
    }
    return createTavernClientForConnection(connection);
}

export async function listRuntimeTasks(input: { chatId?: string; status?: TaskStatus }) {
    const client = await runtimeClient();
    return await client.request<{ tasks: TaskListItem[] }>('/api/tasks', {
        query: { chat_id: input.chatId, status: input.status },
    });
}

export async function convertRuntimeTask(input: {
    assigneeId?: string;
    messageId: string;
    origin?: 'composed' | 'converted';
}) {
    const client = await runtimeClient();
    return await client.request<{ message: TavernChatMessage }>(
        `/api/messages/${encodeURIComponent(input.messageId)}/task`,
        {
            body: {
                ...(input.assigneeId ? { assignee_id: input.assigneeId } : {}),
                ...(input.origin ? { origin: input.origin } : {}),
            },
            method: 'POST',
        }
    );
}

export async function updateRuntimeTask(input: {
    messageId: string;
    patch: {
        assigneeId?: string | null;
        labelIds?: string[];
        priority?: TaskPriority;
        status?: TaskStatus;
    };
}) {
    const client = await runtimeClient();
    return await client.request<{ message: TavernChatMessage }>(
        `/api/tasks/${encodeURIComponent(input.messageId)}`,
        {
            body: {
                assignee_id: input.patch.assigneeId,
                label_ids: input.patch.labelIds,
                priority: input.patch.priority,
                status: input.patch.status,
            },
            method: 'PATCH',
        }
    );
}

export async function reactToRuntimeMessage(input: {
    emoji: string;
    messageId: string;
    remove?: boolean;
}) {
    const client = await runtimeClient();
    return await client.request<{ message: TavernChatMessage }>(
        `/api/messages/${encodeURIComponent(input.messageId)}/reactions`,
        { body: { emoji: input.emoji, remove: input.remove }, method: 'POST' }
    );
}

export async function listRuntimeLabels() {
    const client = await runtimeClient();
    return await client.request<{ labels: LabelRecord[] }>('/api/labels');
}

export async function createRuntimeLabel(name: string) {
    const client = await runtimeClient();
    return await client.request<{ label: LabelRecord }>('/api/labels', {
        body: { name },
        method: 'POST',
    });
}

export async function updateRuntimeLabel(input: {
    labelId: string;
    patch: { color?: LabelRecord['color']; name?: string };
}) {
    const client = await runtimeClient();
    return await client.request<{ label: LabelRecord }>(
        `/api/labels/${encodeURIComponent(input.labelId)}`,
        { body: input.patch, method: 'PATCH' }
    );
}

export async function deleteRuntimeLabel(labelId: string) {
    const client = await runtimeClient();
    return await client.request<{ ok: boolean }>(`/api/labels/${encodeURIComponent(labelId)}`, {
        method: 'DELETE',
    });
}

export async function listRuntimeReminders(statuses?: ReminderRecord['status'][]) {
    const client = await runtimeClient();
    return await client.request<{ reminders: ReminderRecord[] }>('/api/reminders', {
        query: { status: statuses?.join(',') },
    });
}

export async function listRuntimeReminderRuns(input: { limit?: number; reminderId?: string }) {
    const client = await runtimeClient();
    return await client.request<{ runs: ReminderRun[] }>('/api/reminders/runs', {
        query: { limit: input.limit, reminder_id: input.reminderId },
    });
}

export async function cancelRuntimeReminder(reminderId: string) {
    const client = await runtimeClient();
    return await client.request<{ reminder: ReminderRecord }>(
        `/api/reminders/${encodeURIComponent(reminderId)}/cancel`,
        { method: 'POST' }
    );
}
