import type {
    AgentRuntimeTask,
    AgentRuntimeTaskAssignee,
    AgentRuntimeTaskAttachment,
    AgentRuntimeTaskBlockedReason,
    AgentRuntimeTaskKind,
    AgentRuntimeTaskLabel,
    AgentRuntimeTaskPriority,
    AgentRuntimeTaskStatus,
} from '@tavern/api';
import { agentRuntimeTaskSchema } from '@tavern/api';

export interface TaskRow {
    active_dispatch_run_id: string | null;
    assignee_agent_id: string | null;
    assignee_kind: 'agent' | 'user' | null;
    blocked_reason_kind: 'error' | 'needs_input' | null;
    blocked_reason_message: string | null;
    created_at: string;
    description: string | null;
    dispatch_attempts: number;
    dispatch_trigger: 'auto' | 'manual' | null;
    epic_id: string | null;
    id: string;
    kind: AgentRuntimeTaskKind;
    number: number;
    priority: AgentRuntimeTaskPriority;
    scheduled_for: string | null;
    status: AgentRuntimeTaskStatus;
    summary: string | null;
    title: string;
    updated_at: string;
    work_chat_id: string | null;
}

export function taskRowToTask(
    row: TaskRow,
    blockedBy: string[] = [],
    labels: AgentRuntimeTaskLabel[] = [],
    attachments: AgentRuntimeTaskAttachment[] = []
): AgentRuntimeTask {
    return agentRuntimeTaskSchema.parse({
        activeDispatchRunId: row.active_dispatch_run_id,
        assignee: taskAssigneeFromRow(row),
        attachments,
        blockedBy,
        blockedReason: blockedReasonFromRow(row),
        createdAt: row.created_at,
        description: row.description,
        dispatchAttempts: row.dispatch_attempts,
        dispatchTrigger: row.dispatch_trigger,
        epicId: row.epic_id,
        id: row.id,
        kind: row.kind,
        labels,
        number: row.number,
        priority: row.priority,
        scheduledFor: row.scheduled_for,
        status: row.status,
        summary: row.summary,
        title: row.title,
        updatedAt: row.updated_at,
        workChatId: row.work_chat_id,
    });
}

function taskAssigneeFromRow(row: TaskRow): AgentRuntimeTaskAssignee | null {
    if (row.assignee_kind === 'agent' && row.assignee_agent_id) {
        return { agentId: row.assignee_agent_id, kind: 'agent' };
    }

    if (row.assignee_kind === 'user') {
        return { kind: 'user' };
    }

    return null;
}

function blockedReasonFromRow(row: TaskRow): AgentRuntimeTaskBlockedReason | null {
    if (!row.blocked_reason_kind) {
        return null;
    }

    return {
        kind: row.blocked_reason_kind,
        message: row.blocked_reason_message ?? '',
    };
}
