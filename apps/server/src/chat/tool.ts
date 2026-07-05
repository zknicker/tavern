import type { TavernResponseActivity } from '@tavern/sdk';
import { TRPCError } from '@trpc/server';
import { createTavernClientForConnection } from '../agent-runtime/client-factory.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import { buildToolActions } from '../tools/actions.ts';
import { toolDetailSchema } from '../tools/contracts.ts';
import { buildToolSummaryFromValues } from '../tools/summary.ts';

export async function getChatToolActivity(input: { activityId: string; chatId: string }) {
    const connection = await getActiveAgentRuntimeConnection();

    if (!(connection?.enabled && connection.baseUrl)) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No active Tavern Runtime connection is available for chat "${input.chatId}".`,
        });
    }

    const client = createTavernClientForConnection(connection);
    try {
        return activityToToolDetail(await client.chat.activity(input.chatId, input.activityId));
    } catch (error) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            cause: error,
            message: `No stored tool activity "${input.activityId}" was found for chat "${input.chatId}".`,
        });
    }
}

function activityToToolDetail(activity: TavernResponseActivity) {
    const metadata = readRecord(activity.metadata);
    const runtime = readRecord(metadata.runtime);
    const tool = readRecord(metadata.tool);
    const argumentsValue = Object.hasOwn(tool, 'arguments') ? tool.arguments : null;
    const resultValue = Object.hasOwn(tool, 'result') ? tool.result : null;
    const toolName =
        readString(runtime.toolName) ?? readString(tool.name) ?? activityName(activity);
    const toolCallId = readString(runtime.toolCallId);

    const toolCall = buildToolSummaryFromValues({
        argumentsValue,
        callId: toolCallId,
        isError: activity.status === 'failed',
        name: toolName,
        resultValue,
    });

    return toolDetailSchema.parse({
        actions: buildToolActions({
            argumentsValue,
            resultValue,
            toolName,
        }),
        arguments: argumentsValue,
        completedAt: activity.completed_at,
        result: resultValue,
        startedAt: activity.started_at,
        toolCall: {
            ...toolCall,
            label: activity.title,
            summaryParts: [activity.title],
        },
    });
}

function activityName(activity: TavernResponseActivity) {
    if (activity.kind === 'command') {
        return 'command';
    }
    if (activity.kind === 'reasoning') {
        return 'reasoning';
    }
    if (activity.kind === 'message') {
        return 'message';
    }
    return 'tool';
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
