import type { AgentRuntimeTask } from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import { getAgentTurn } from '../tavern/agent-turn-store.ts';
import { createAgentParticipantId } from '../tavern/chat-api/ids.ts';
import { createMessage } from '../tavern/chat-api/index.ts';

const terminalStatuses = new Set(['blocked', 'review', 'done', 'canceled']);

export function sendTaskTerminalNotification(input: {
    db: Database;
    runId: string;
    task: AgentRuntimeTask;
}) {
    const { task } = input;
    if (
        task.dispatchTrigger !== 'auto' ||
        !task.originChatId ||
        task.originChatId === task.workChatId ||
        !terminalStatuses.has(task.status)
    ) {
        return false;
    }

    const agentId =
        getAgentTurn(input.runId, input.db)?.agentId ??
        (task.assignee?.kind === 'agent' ? task.assignee.agentId : null);
    if (!agentId) {
        return false;
    }
    createMessage(
        task.originChatId,
        {
            author_id: createAgentParticipantId(agentId),
            content: notificationContent(task),
            id: notificationMessageId(input.runId),
            metadata: {
                runtime: {
                    agentId,
                    runId: input.runId,
                    source: 'task-dispatch',
                    taskId: task.id,
                    type: 'terminal-notification',
                },
            },
            nonce: `task-terminal:${input.runId}`,
            role: 'assistant',
        },
        input.db
    );
    return true;
}

function notificationContent(task: AgentRuntimeTask) {
    if (task.status === 'blocked') {
        const reason = task.blockedReason;
        if (!reason) {
            return `T-${task.number} is blocked.`;
        }
        const kind = reason.kind === 'needs_input' ? 'needs input' : 'error';
        return withDetail(`T-${task.number} is blocked (${kind})`, firstLine(reason.message));
    }
    const phrase =
        task.status === 'review'
            ? 'is ready for review'
            : task.status === 'canceled'
              ? 'was canceled'
              : 'is done';
    return withDetail(`T-${task.number} ${phrase}`, firstLine(task.summary));
}

function withDetail(prefix: string, detail: string | null) {
    return detail ? `${prefix}: ${detail}` : `${prefix}.`;
}

function firstLine(value: string | null) {
    const line = value?.split(/\r?\n/u, 1)[0]?.trim();
    return line || null;
}

function notificationMessageId(runId: string) {
    return `msg_task_terminal_${runId.replace(/[^A-Za-z0-9_-]/gu, '_')}`;
}
