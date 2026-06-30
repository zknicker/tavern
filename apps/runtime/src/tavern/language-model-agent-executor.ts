import {
    generateText,
    type LanguageModel,
    type ModelMessage,
    stepCountIs,
    type ToolExecutionEndEvent,
    type ToolExecutionStartEvent,
} from 'ai';
import {
    type AgentLanguageModelConfig,
    resolveAgentLanguageModelConfig,
} from '../agent-engine/model-config.ts';
import {
    hasRenderableRichResponse,
    parseRichResponseFromAssistantContent,
    richResponseActivity,
} from '../rich-responses/render.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import {
    createDelivery,
    getMessage,
    listRecentMessagesBefore,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { createLanguageModelTools } from './language-model-tools.ts';

const emptyAssistantMessageDiagnostic = 'No reply: the model returned empty content.';

export function createLanguageModelAgentExecutor(): AgentExecutor {
    return createLanguageModelAgentExecutorWithConfig({
        resolveConfig: resolveAgentLanguageModelConfig,
    });
}

export function createLanguageModelAgentExecutorWithConfig(options: {
    resolveConfig: typeof resolveAgentLanguageModelConfig;
}): AgentExecutor {
    const active = new Map<string, AbortController>();

    return {
        async execute(input) {
            const controller = new AbortController();
            active.set(input.runId, controller);
            try {
                return await executeLanguageModelTurn(input, controller.signal, {
                    resolveConfig: options.resolveConfig,
                });
            } finally {
                active.delete(input.runId);
            }
        },
        stop(runId) {
            const controller = active.get(runId);
            if (!controller) {
                return false;
            }
            controller.abort();
            return true;
        },
    };
}

async function executeLanguageModelTurn(
    input: AgentExecutorInput,
    abortSignal: AbortSignal,
    options: {
        resolveConfig: (input: {
            agentId?: string;
            modelName?: AgentExecutorInput['agentSession']['effectiveModel'];
        }) => Promise<AgentLanguageModelConfig>;
    }
) {
    const startedAt = new Date().toISOString();
    const runtime = runtimeMetadata(input);

    const config = await options.resolveConfig({
        agentId: input.agent.id,
        modelName: input.agentSession.effectiveModel,
    });
    assertLanguageModelRoute(config.provider);
    const toolActivityIds = new Set<string>();
    const toolStartedAt = new Map<string, string>();
    const tools = config.wrapTools(
        createLanguageModelTools({
            workspaceFolder: input.agent.workspaceFolder,
        })
    );

    const result = await generateText({
        abortSignal,
        maxRetries: 1,
        messages: buildPromptMessages(input),
        model: config.model as LanguageModel,
        onToolExecutionEnd: (event) => {
            const toolActivityId = toolActivityIdForRun(input.runId, event.toolCall.toolCallId);
            toolActivityIds.add(toolActivityId);
            upsertCompletedToolActivity(input, {
                activityId: toolActivityId,
                completedAt: new Date().toISOString(),
                event,
                runtime,
                startedAt: toolStartedAt.get(toolActivityId) ?? startedAt,
            });
        },
        onToolExecutionStart: (event) => {
            const toolActivityId = toolActivityIdForRun(input.runId, event.toolCall.toolCallId);
            const toolStart = new Date().toISOString();
            toolActivityIds.add(toolActivityId);
            toolStartedAt.set(toolActivityId, toolStart);
            upsertRunningToolActivity(input, {
                activityId: toolActivityId,
                event,
                runtime,
                startedAt: toolStart,
            });
        },
        stopWhen: stepCountIs(8),
        system: systemPrompt(input),
        tools,
    });
    const completedAt = new Date().toISOString();
    const responseContent = result.text.trim() || emptyAssistantMessageDiagnostic;
    const richResponse = parseRichResponseFromAssistantContent(responseContent);
    const messageContent = richResponse?.displayContent ?? responseContent;
    const messageId = assistantMessageId(input.runId);
    const deliveryId = deliveryIdForRun(input.runId);
    const receipt = createDelivery(input.chatId, {
        agent_id: input.agentSession.agentParticipantId,
        id: deliveryId,
        message: {
            attachments: [],
            author_id: input.agentSession.agentParticipantId,
            content: messageContent,
            id: messageId,
            metadata: {
                runtime: {
                    ...runtime,
                    model: input.agentSession.effectiveModel,
                },
            },
            role: 'assistant',
        },
        metadata: {
            runtime: {
                ...runtime,
                model: input.agentSession.effectiveModel,
            },
        },
        turn_id: input.runId,
    });

    const activityIds = [...toolActivityIds];
    if (hasRenderableRichResponse(richResponse)) {
        const richResponseActivityId = richResponseActivityIdForRun(input.runId);
        upsertResponseActivity(
            input.chatId,
            input.responseId,
            richResponseActivity({
                activityId: richResponseActivityId,
                agentId: input.agent.id,
                fallbackText: richResponse.fallbackText,
                messageId,
                render: richResponse.render,
                runId: input.runId,
                sessionKey: input.agentSession.id,
                source: 'agent-engine',
                startedAt,
                timestamp: completedAt,
            })
        );
        activityIds.push(richResponseActivityId);
    }

    upsertResponse(input.chatId, {
        completed_at: completedAt,
        id: input.responseId,
        metadata: {
            runtime: {
                ...runtime,
                completedAt,
                model: input.agentSession.effectiveModel,
            },
        },
        participant_id: input.agentSession.agentParticipantId,
        request_message_id: input.requestMessageId,
        response_message_id: receipt.message.id,
        status: 'completed',
        summary: 'Agent response completed.',
    });

    return {
        activityIds,
        outputMessageIds: [receipt.message.id],
    };
}

function buildPromptMessages(input: AgentExecutorInput): ModelMessage[] {
    const request = getMessage(input.requestMessageId);
    const previousMessages = request
        ? listRecentMessagesBefore(input.chatId, {
              beforeSequence: request.sequence,
              limit: 24,
          })
        : [];
    const messages = [...previousMessages, ...(request ? [request] : [])];

    return messages.flatMap((message): ModelMessage[] => {
        if (message.deleted_at) {
            return [];
        }
        if (message.role !== 'assistant' && message.role !== 'user') {
            return [];
        }
        const label = message.author.label ?? message.author.id;
        const content = `${label}: ${message.content}`;
        return [{ content, role: message.role }];
    });
}

function systemPrompt(input: AgentExecutorInput) {
    return [
        `You are ${input.agent.name}, a Tavern agent participating in a shared chat.`,
        'Answer as yourself in the current conversation.',
        'Use the provided tools when they help. The current runtime provides trusted local workspace tools.',
        'Keep replies concise and useful.',
    ].join('\n');
}

function assertLanguageModelRoute(provider: string) {
    if (provider !== 'e2e' && provider !== 'openai' && provider !== 'openai-compatible') {
        throw new Error(`Model provider "${provider}" is not a language-model executor route yet.`);
    }
}

function runtimeMetadata(input: AgentExecutorInput) {
    return {
        agentId: input.agent.id,
        agentSessionId: input.agentSession.id,
        engine: 'agent-engine',
        messageId: input.requestMessageId,
        runId: input.runId,
        source: 'agent-engine',
    };
}

function assistantMessageId(runId: string) {
    return `msg_${sanitizeId(runId)}_assistant`;
}

function deliveryIdForRun(runId: string) {
    return `del_${sanitizeId(runId)}_assistant`;
}

function toolActivityIdForRun(runId: string, toolCallId: string) {
    return `act_${sanitizeId(runId)}_tool_${sanitizeId(toolCallId)}`;
}

function richResponseActivityIdForRun(runId: string) {
    return `act_${sanitizeId(runId)}_rich_response`;
}

function sanitizeId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

function upsertRunningToolActivity(
    input: AgentExecutorInput,
    eventInput: {
        activityId: string;
        event: ToolExecutionStartEvent;
        runtime: ReturnType<typeof runtimeMetadata>;
        startedAt: string;
    }
) {
    const toolCall = eventInput.event.toolCall;
    upsertResponseActivity(input.chatId, input.responseId, {
        detail: toolActivityDetail(toolCall.toolName, toolCall.input),
        id: eventInput.activityId,
        kind: 'tool_call',
        metadata: {
            runtime: {
                ...eventInput.runtime,
                model: input.agentSession.effectiveModel,
            },
            tool: {
                arguments: toolCall.input,
                name: toolCall.toolName,
            },
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
        },
        started_at: eventInput.startedAt,
        status: 'running',
        title: toolActivityTitle('running', toolCall.toolName, toolCall.input),
    });
}

function upsertCompletedToolActivity(
    input: AgentExecutorInput,
    eventInput: {
        activityId: string;
        completedAt: string;
        event: ToolExecutionEndEvent;
        runtime: ReturnType<typeof runtimeMetadata>;
        startedAt: string;
    }
) {
    const toolCall = eventInput.event.toolCall;
    const output = toolOutputValue(eventInput.event);
    const failed = eventInput.event.toolOutput.type === 'tool-error';

    upsertResponseActivity(input.chatId, input.responseId, {
        completed_at: eventInput.completedAt,
        detail: toolActivityDetail(toolCall.toolName, toolCall.input),
        id: eventInput.activityId,
        kind: 'tool_call',
        metadata: {
            runtime: {
                ...eventInput.runtime,
                model: input.agentSession.effectiveModel,
                toolExecutionMs: eventInput.event.toolExecutionMs,
            },
            tool: {
                arguments: toolCall.input,
                name: toolCall.toolName,
                result: output,
            },
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
        },
        started_at: eventInput.startedAt,
        status: failed ? 'failed' : 'completed',
        title: toolActivityTitle(
            failed ? 'failed' : 'completed',
            toolCall.toolName,
            toolCall.input
        ),
    });
}

function toolOutputValue(event: ToolExecutionEndEvent) {
    if (event.toolOutput.type === 'tool-result') {
        return event.toolOutput.output;
    }
    return {
        error: stringifyError(event.toolOutput.error),
    };
}

function toolActivityTitle(
    status: 'completed' | 'failed' | 'running',
    toolName: string,
    input: unknown
) {
    const subject = toolActivitySubject(toolName, input);
    if (status === 'running') {
        return subject ?? `Using ${toolName}`;
    }
    if (status === 'failed') {
        return subject ? `Failed ${subject}` : `Failed ${toolName}`;
    }
    return subject ?? `Used ${toolName}`;
}

function toolActivityDetail(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return record.command;
    }
    if (toolName === 'read_file' && typeof record.path === 'string') {
        return record.path;
    }
    return undefined;
}

function toolActivitySubject(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return 'terminal';
    }
    if (toolName === 'read_file' && typeof record.path === 'string') {
        return record.path;
    }
    return null;
}

function stringifyError(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
