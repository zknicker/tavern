import type { AgentRuntimeChatStatus, TavernApiSchema, TavernChatActivity } from '@tavern/api';
import { listActivity } from './chat-api';

export function listTavernActiveChannelStatuses(): AgentRuntimeChatStatus[] {
    return listActivity().activities.filter(isActiveActivity).map(activityToChatStatus);
}

function isActiveActivity(activity: TavernChatActivity) {
    return activity.status === 'queued' || activity.status === 'running';
}

function activityToChatStatus(activity: TavernChatActivity): AgentRuntimeChatStatus {
    const startedAt = activityMetadataString(activity, 'startedAt') ?? activity.updated_at;
    const sessionKey = activityMetadataString(activity, 'sessionKey') ?? activity.chat_id;
    const steps = activity.steps.map(activityStepToProgressStep);

    return {
        activeReply: {
            agentId: activityMetadataString(activity, 'agentId') ?? activity.agent_id,
            isThinking: true,
            runId: activity.run_id,
            sessionKey,
            startedAt,
            text: activity.summary ?? '',
        },
        ...(steps.length > 0
            ? {
                  activeReplyProgressStartedAt: steps[0]?.startedAt ?? activity.updated_at,
                  activeReplySteps: steps.map(({ startedAt: _startedAt, ...step }) => step),
              }
            : {}),
        chatId: activity.chat_id,
    };
}

function activityStepToProgressStep(step: TavernApiSchema<'ActivityStep'>) {
    return {
        ...(typeof step.metadata.detail === 'string' ? { detail: step.metadata.detail } : {}),
        id: step.id,
        kind: activityStepKind(step.kind),
        label: step.label,
        startedAt: step.started_at,
        status:
            step.status === 'running'
                ? ('active' as const)
                : step.status === 'queued'
                  ? ('active' as const)
                  : step.status,
    };
}

function activityStepKind(kind: TavernApiSchema<'ActivityStep'>['kind']) {
    if (kind === 'thinking') {
        return 'reasoning' as const;
    }
    if (kind === 'custom') {
        return 'plan' as const;
    }
    if (kind === 'file') {
        return 'tool' as const;
    }
    return kind;
}

function activityMetadataString(activity: TavernChatActivity, key: string) {
    const runtime = activity.metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}
