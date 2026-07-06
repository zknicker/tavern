import type { AgentRuntimeChat, AgentRuntimeTask } from '@tavern/api';
import { emitTasksUpdated } from '../api/invalidation-events.ts';
import { listRuntimeChatRecords } from '../chat/runtime-chats.ts';
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
    const chatId = await resolveAgentDmChatId(parsed.agentId);

    const assigned = await client.updateTask(task.id, {
        assignee: { agentId: parsed.agentId, kind: 'agent' },
    });
    await saveTaskRecord({ runtimeId, task: assigned });

    await sendTavernChatMessage({
        chatId,
        content: buildDispatchMessage(assigned),
    });
    emitTasksUpdated();

    return dispatchTaskResultSchema.parse({ chatId, task: assigned });
}

async function resolveAgentDmChatId(agentId: string) {
    const records = await listRuntimeChatRecords();
    const dmRecord = records.find(
        (record) =>
            record.chat.platform === 'tavern' &&
            record.chat.scope === 'dm' &&
            hasAgentParticipant(record.chat, agentId)
    );

    if (!dmRecord) {
        throw new Error('The selected agent has no direct chat to dispatch into.');
    }

    return dmRecord.chat.id;
}

function hasAgentParticipant(chat: AgentRuntimeChat, agentId: string) {
    const participantIds = new Set([agentId, `agt_${agentId}`]);

    return chat.participants.some(
        (participant) => participant.type === 'agent' && participantIds.has(participant.agentId)
    );
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
