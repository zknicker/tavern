import type {
    AgentRuntimeTask,
    AgentRuntimeTaskAssignee,
    AgentRuntimeTaskBlockedReason,
    AgentRuntimeTaskKind,
    AgentRuntimeTaskPriority,
    AgentRuntimeTaskStatus,
} from '@tavern/api';
import { agentRuntimeTaskSchema } from '@tavern/api';

export interface TaskRow {
    assignee_agent_id: string | null;
    assignee_kind: 'agent' | 'user' | null;
    blocked_reason_kind: 'error' | 'needs_input' | null;
    blocked_reason_message: string | null;
    created_at: string;
    description: string | null;
    epic_id: string | null;
    id: string;
    kind: AgentRuntimeTaskKind;
    labels_json: string;
    number: number;
    priority: AgentRuntimeTaskPriority;
    scheduled_for: string | null;
    status: AgentRuntimeTaskStatus;
    summary: string | null;
    title: string;
    updated_at: string;
}

export function taskRowToTask(row: TaskRow, blockedBy: string[] = []): AgentRuntimeTask {
    return agentRuntimeTaskSchema.parse({
        assignee: taskAssigneeFromRow(row),
        blockedBy,
        blockedReason: blockedReasonFromRow(row),
        createdAt: row.created_at,
        description: row.description,
        epicId: row.epic_id,
        id: row.id,
        kind: row.kind,
        labels: JSON.parse(row.labels_json),
        number: row.number,
        priority: row.priority,
        scheduledFor: row.scheduled_for,
        status: row.status,
        summary: row.summary,
        title: row.title,
        updatedAt: row.updated_at,
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
