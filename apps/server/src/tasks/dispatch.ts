import type { AgentRuntimeChat, AgentRuntimeTask } from '@tavern/api';
import { emitTasksUpdated } from '../api/invalidation-events.ts';
import { getRuntimeChatRecord, updateRuntimeTavernChat } from '../chat/runtime-chats.ts';
import { createTavernChat } from '../chat/save.ts';
import { sendTavernChatMessage } from '../chat/send.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { saveTaskRecord } from '../storage/tasks.ts';
import { dispatchTaskInputSchema, dispatchTaskResultSchema } from './contracts.ts';
import { requireActiveTaskRuntime } from './mutations.ts';

export async function dispatchTask(input: unknown) {
    const parsed = dispatchTaskInputSchema.parse(input);
    const agent = await getAgentRecord(parsed.agentId);

    if (!agent) {
        throw new Error(`No agent named "${parsed.agentId}" exists.`);
    }

    const { client, runtimeId } = await requireActiveTaskRuntime();
    const task = await client.getTask(parsed.taskId);
    const chatId = await ensureTaskWorkChat({
        agentId: parsed.agentId,
        task,
    });
    if (task.workChatId !== chatId) {
        await saveTaskRecord({
            runtimeId,
            task: await client.setTaskWorkChat(task.id, { workChatId: chatId }),
        });
    }

    const assigned = await client.updateTask(task.id, {
        assignee: { agentId: parsed.agentId, kind: 'agent' },
    });
    await saveTaskRecord({ runtimeId, task: assigned });

    await sendTavernChatMessage({
        agentId: parsed.agentId,
        chatId,
        content: buildDispatchMessage(assigned),
    });
    emitTasksUpdated();

    return dispatchTaskResultSchema.parse({ chatId, task: assigned });
}

async function ensureTaskWorkChat(input: { agentId: string; task: AgentRuntimeTask }) {
    const displayName = taskWorkChatTitle(input.task);
    if (input.task.workChatId) {
        const existing = await getRuntimeChatRecord(input.task.workChatId);
        if (existing) {
            await updateRuntimeTavernChat({
                agentIds: agentIdsForTaskChat(existing.chat, input.agentId),
                archived: false,
                displayName,
                id: existing.chat.id,
                kind: 'task',
            });
            return existing.chat.id;
        }
    }

    const created = await createTavernChat({
        agentIds: [input.agentId],
        displayName,
        kind: 'task',
    });
    return created.chatId;
}

function agentIdsForTaskChat(chat: AgentRuntimeChat, agentId: string) {
    const ids = new Set(chat.bindings.map((binding) => binding.agentId));
    for (const participant of chat.participants) {
        if (participant.type === 'agent') {
            ids.add(participant.agentId);
        }
    }
    ids.add(agentId);

    return [...ids];
}

function taskWorkChatTitle(task: AgentRuntimeTask) {
    return `T-${task.number}: ${task.title}`;
}

function buildDispatchMessage(task: AgentRuntimeTask) {
    const lines = [`You've been dispatched task T-${task.number}: ${task.title}`];

    if (task.description) {
        lines.push('', task.description);
    }

    lines.push(
        '',
        `Start working on it now. Use your tasks tools to keep T-${task.number} current: mark it in_progress while you work and done when you finish.`
    );

    return lines.join('\n');
}
