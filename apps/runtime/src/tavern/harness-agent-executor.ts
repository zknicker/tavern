import path from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import {
    HarnessAgent,
    type HarnessAgentResumeSessionState,
    type HarnessAgentSession,
    type HarnessAgentSkill,
} from '@ai-sdk/harness/agent';
import { type ClaudeCodeAuthOptions, createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { createPi, type PiAuthOptions } from '@ai-sdk/harness-pi';
import type { Context, ToolSet } from '@ai-sdk/provider-utils';
import type {
    AgentRuntimeModelName,
    AgentRuntimeThinkingLevel,
    TavernChatMessage,
} from '@tavern/api';
import type { GenerateTextResult } from 'ai';
import { createLocalTrustedSandboxProvider } from '../agent-engine/local-trusted-sandbox.ts';
import {
    type AssignedSkillBundle,
    readAssignedSkillBundles,
} from '../agent-engine/skill-library.ts';
import { readConfigValue } from '../config.ts';
import {
    hasRenderableRichResponse,
    parseRichResponseFromAssistantContent,
    richResponseActivity,
} from '../rich-responses/render.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructions } from './agent-instructions.ts';
import { updateAgentSessionRuntimeState } from './agent-session-store.ts';
import {
    createDelivery,
    getChat,
    getMessage,
    listRecentMessagesBetween,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { createTavernChatTools } from './chat-context-tools.ts';

const emptyAssistantMessageDiagnostic = 'No reply: the harness returned empty content.';
const maxAmbientContextMessages = 20;

interface ActiveHarnessTurn {
    controller: AbortController;
    session?: { destroy(): Promise<void> };
}

export function createHarnessAgentExecutor(): AgentExecutor {
    const active = new Map<string, ActiveHarnessTurn>();

    return {
        async execute(input) {
            const controller = new AbortController();
            const activeTurn: ActiveHarnessTurn = { controller };
            active.set(input.runId, activeTurn);
            try {
                return await executeHarnessTurn(input, controller.signal, activeTurn);
            } finally {
                active.delete(input.runId);
            }
        },
        async stop(runId) {
            const turn = active.get(runId);
            if (!turn) {
                return false;
            }
            turn.controller.abort();
            await turn.session?.destroy().catch(() => {});
            return true;
        },
    };
}

async function executeHarnessTurn(
    input: AgentExecutorInput,
    abortSignal: AbortSignal,
    activeTurn: ActiveHarnessTurn
) {
    const startedAt = new Date().toISOString();
    const runtime = runtimeMetadata(input);

    const instructions = buildAgentInstructions(input);
    const skills = await readHarnessAgentSkills(input);
    const agent = createHarnessAgent(input, createLocalTrustedSandboxProvider, {
        instructions,
        skills,
    });
    let session: HarnessAgentSession | undefined;
    let result: GenerateTextResult<ToolSet, Context, never>;
    try {
        session = await agent.createSession({
            abortSignal,
            resumeFrom: input.agentSession.resumeState as
                | HarnessAgentResumeSessionState
                | undefined,
            sessionId: input.agentSession.runtimeSessionId ?? input.agentSession.id,
        });
        activeTurn.session = session;

        result = await agent.generate({
            abortSignal,
            prompt: harnessPrompt(input),
            session,
        });
        const resumeState = await session.stop();
        activeTurn.session = undefined;
        const promptContextSequence = promptCursorSequence(input);
        updateAgentSessionRuntimeState({
            id: input.agentSession.id,
            promptContextSequence,
            resumeState: resumeState as Record<string, unknown>,
            runtimeSessionId: session.sessionId,
        });
    } catch (error) {
        activeTurn.session = undefined;
        await session?.destroy().catch(() => {});
        throw formatHarnessExecutionError(input, error);
    }

    const completedAt = new Date().toISOString();
    const activityIds = persistHarnessToolActivities(input, result, {
        completedAt,
        runtime,
        startedAt,
    });
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

    const allActivityIds = [...activityIds];
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
        allActivityIds.push(richResponseActivityId);
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
        activityIds: allActivityIds,
        outputMessageIds: [receipt.message.id],
    };
}

function createHarnessAgent(
    input: AgentExecutorInput,
    sandboxFactory: typeof createLocalTrustedSandboxProvider,
    options: {
        instructions: string;
        skills: HarnessAgentSkill[];
    }
) {
    const harness = createHarness(input);
    return new HarnessAgent({
        harness,
        id: input.agent.id,
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: sandboxFactory(localTrustedSandboxOptions(input)),
        skills: options.skills,
        tools: createTavernChatTools({
            chatId: input.chatId,
        }),
    });
}

async function readHarnessAgentSkills(input: AgentExecutorInput): Promise<HarnessAgentSkill[]> {
    const skills = await readAssignedSkillBundles(input.agent);
    return skills.map(toHarnessAgentSkill);
}

function toHarnessAgentSkill(skill: AssignedSkillBundle): HarnessAgentSkill {
    return {
        content: skill.content,
        description: skill.description,
        ...(skill.files.length > 0 ? { files: skill.files } : {}),
        name: skill.id,
    };
}

function localTrustedSandboxOptions(input: AgentExecutorInput) {
    if (input.agentSession.effectiveModel.provider !== 'codex') {
        return { rootDir: input.agent.workspaceFolder };
    }
    const homeDir = path.join(input.agent.workspaceFolder, '.home');
    return {
        authProfiles: ['codex'] as const,
        env: {
            CODEX_HOME: path.join(homeDir, '.codex'),
            HOME: homeDir,
        },
        rootDir: input.agent.workspaceFolder,
    };
}

function createHarness(input: AgentExecutorInput): HarnessV1<ToolSet> {
    const modelName = input.agentSession.effectiveModel;
    switch (modelName.provider) {
        case 'claude':
            return createClaudeCode({
                auth: claudeCodeAuthOptions(),
                maxTurns: 8,
                model: modelName.model,
                thinking: claudeThinking(input.agent.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'codex':
            return createCodex({
                model: modelName.model,
                reasoningEffort: codexReasoningEffort(input.agent.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'openai':
        case 'openai-compatible': {
            const auth = piAuthOptions(modelName.provider);
            const thinkingLevel = piThinkingLevel(input.agent.thinkingDefault);
            return createPi({
                ...(auth ? { auth } : {}),
                model: piModelId(modelName, auth),
                ...(thinkingLevel ? { thinkingLevel } : {}),
            }) as HarnessV1<ToolSet>;
        }
        default:
            throw new Error(`Unsupported harness model provider "${modelName.provider}".`);
    }
}

export function claudeCodeAuthOptions(): ClaudeCodeAuthOptions | undefined {
    const authToken =
        readConfigValue('TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN') ??
        readConfigValue('ANTHROPIC_AUTH_TOKEN');
    const baseUrl =
        readConfigValue('TAVERN_AGENT_CLAUDE_CODE_BASE_URL') ??
        readConfigValue('ANTHROPIC_BASE_URL');
    if (!(authToken || baseUrl)) {
        return undefined;
    }
    return {
        anthropic: {
            ...(authToken ? { authToken } : {}),
            ...(baseUrl ? { baseUrl } : {}),
        },
    };
}

export function piAuthOptions(
    provider: AgentRuntimeModelName['provider']
): PiAuthOptions | undefined {
    if (provider === 'openai') {
        const apiKey = readConfigValue('TAVERN_AGENT_API_KEY') ?? readConfigValue('OPENAI_API_KEY');
        return apiKey ? { customEnv: { OPENAI_API_KEY: apiKey } } : undefined;
    }
    if (provider === 'openai-compatible') {
        const baseUrl = readConfigValue('TAVERN_AGENT_BASE_URL');
        if (!baseUrl) {
            return undefined;
        }
        return {
            customEnv: {
                OPENAI_API_KEY: readConfigValue('TAVERN_AGENT_API_KEY') ?? 'tavern-local',
                OPENAI_BASE_URL: baseUrl,
            },
        };
    }
    return undefined;
}

function piModelId(model: AgentRuntimeModelName, auth: PiAuthOptions | undefined) {
    if (model.provider === 'openai' && !auth?.customEnv && hasAiGatewayAuth()) {
        return `openai/${model.model}`;
    }
    return model.model;
}

function hasAiGatewayAuth() {
    return Boolean(readConfigValue('AI_GATEWAY_API_KEY') ?? readConfigValue('VERCEL_OIDC_TOKEN'));
}

export function formatHarnessExecutionError(input: AgentExecutorInput, error: unknown): Error {
    const message = errorMessage(error);
    if (
        input.agentSession.effectiveModel.provider === 'claude' &&
        /401|authenticat|credential/iu.test(message)
    ) {
        return new Error(
            [
                'Claude Code failed to authenticate for Tavern agent execution.',
                'Verify `claude -p "hello"` works in this shell, or run `claude setup-token` and set TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN for the Runtime.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (
        (input.agentSession.effectiveModel.provider === 'openai' ||
            input.agentSession.effectiveModel.provider === 'openai-compatible') &&
        /401|authenticat|credential|api key/iu.test(message)
    ) {
        return new Error(
            [
                'Pi failed to authenticate for Tavern agent execution.',
                'Verify AI Gateway, OPENAI_API_KEY, or TAVERN_AGENT_API_KEY/TAVERN_AGENT_BASE_URL is configured for the selected model.',
                `Original error: ${message}`,
            ].join(' ')
        );
    }
    if (error instanceof Error) {
        return error;
    }
    return new Error(message);
}

export function harnessPrompt(input: AgentExecutorInput) {
    const context = buildHarnessPromptContext(input);
    const sections = [
        'Current Tavern chat:',
        `- chatId: ${input.chatId}`,
        `- triggering messageId: ${input.requestMessageId}`,
        context.currentMessage ? `- triggering sequence: ${context.currentMessage.sequence}` : null,
        '',
        'Available Tavern chat tools:',
        '- chat_messages_list: list current-chat messages by sequence cursor',
        '- chat_messages_search: search current-chat messages',
        '- chat_message_get: read one current-chat message by id',
    ].filter((line): line is string => line !== null);

    if (context.ambientMessages.length > 0) {
        sections.push(
            '',
            'Ambient Tavern channel context since you were last invoked:',
            ...context.ambientMessages.map(formatPromptMessage)
        );
        if (context.ambientMessagesOmitted) {
            sections.push(
                `${context.ambientMessages.length} most recent ambient messages shown; earlier messages were omitted. Use chat_messages_list or chat_messages_search if needed.`
            );
        }
    }

    if (context.replyContext) {
        sections.push('', 'Reply context:', formatPromptMessage(context.replyContext));
    }

    sections.push(
        '',
        `Current message for ${input.agent.name}:`,
        formatPromptMessageContent(input)
    );

    return sections.join('\n');
}

function buildHarnessPromptContext(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    const chat = getChat(input.chatId);
    const ambientCandidates =
        request && chat?.kind === 'channel'
            ? listRecentMessagesBetween(input.chatId, {
                  afterSequence: input.agentSession.promptContextSequence,
                  beforeSequence: request.sequence,
                  limit: maxAmbientContextMessages + 1,
              })
            : [];
    const filteredAmbientMessages = ambientCandidates.filter((message) =>
        isAmbientPromptMessage(input, message)
    );
    const ambientMessages = filteredAmbientMessages.slice(-maxAmbientContextMessages);
    const replyContext = request?.parent_message_id
        ? getReplyContext({
              ambientMessages,
              currentMessageId: request.id,
              parentMessageId: request.parent_message_id,
          })
        : null;

    return {
        ambientMessages,
        ambientMessagesOmitted: filteredAmbientMessages.length > maxAmbientContextMessages,
        currentMessage: request,
        replyContext,
    };
}

function promptCursorSequence(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    return request?.sequence ?? input.agentSession.promptContextSequence;
}

function getReplyContext(input: {
    ambientMessages: TavernChatMessage[];
    currentMessageId: string;
    parentMessageId: string;
}) {
    if (
        input.parentMessageId === input.currentMessageId ||
        input.ambientMessages.some((message) => message.id === input.parentMessageId)
    ) {
        return null;
    }
    const message = getMessage(input.parentMessageId);
    if (
        message &&
        !message.deleted_at &&
        (message.role === 'assistant' || message.role === 'user')
    ) {
        return message;
    }
    return null;
}

function isAmbientPromptMessage(input: AgentExecutorInput, message: TavernChatMessage) {
    if (message.deleted_at) {
        return false;
    }
    if (message.role !== 'assistant' && message.role !== 'user') {
        return false;
    }
    return message.author.id !== input.agentSession.agentParticipantId;
}

function formatPromptMessage(message: TavernChatMessage) {
    const label = message.author.label ?? message.author.id;
    return `[seq:${message.sequence} id:${message.id}] ${label}: ${message.content}`;
}

function formatPromptMessageContent(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    if (request) {
        return formatPromptMessage(request);
    }
    return input.content;
}

function persistHarnessToolActivities(
    input: AgentExecutorInput,
    result: GenerateTextResult<ToolSet, Context, never>,
    eventInput: {
        completedAt: string;
        runtime: ReturnType<typeof runtimeMetadata>;
        startedAt: string;
    }
) {
    const toolResults = new Map(
        result.toolResults.map((toolResult) => [toolResult.toolCallId, toolResult])
    );
    const activityIds: string[] = [];
    for (const toolCall of result.toolCalls) {
        const activityId = toolActivityIdForRun(input.runId, toolCall.toolCallId);
        const toolResult = toolResults.get(toolCall.toolCallId);
        activityIds.push(activityId);
        upsertResponseActivity(input.chatId, input.responseId, {
            completed_at: eventInput.completedAt,
            detail: toolActivityDetail(toolCall.toolName, toolCall.input),
            id: activityId,
            kind: 'tool_call',
            metadata: {
                runtime: {
                    ...eventInput.runtime,
                    model: input.agentSession.effectiveModel,
                },
                tool: {
                    arguments: toolCall.input,
                    name: toolCall.toolName,
                    ...(toolResult ? { result: toolResult.output } : {}),
                },
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
            },
            started_at: eventInput.startedAt,
            status: 'completed',
            title: toolActivityTitle(toolCall.toolName, toolCall.input, toolCall.title),
        });
    }
    return activityIds;
}

function claudeThinking(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (value === 'off') {
        return 'off';
    }
    if (value === 'adaptive') {
        return 'adaptive';
    }
    return value ? 'on' : undefined;
}

function codexReasoningEffort(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (value === 'low' || value === 'minimal') {
        return 'low';
    }
    if (value === 'medium') {
        return 'medium';
    }
    if (value && value !== 'off') {
        return 'high';
    }
    return undefined;
}

function piThinkingLevel(value: AgentRuntimeThinkingLevel | null | undefined) {
    if (
        value === 'off' ||
        value === 'minimal' ||
        value === 'low' ||
        value === 'medium' ||
        value === 'high'
    ) {
        return value;
    }
    return undefined;
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

function toolActivityTitle(toolName: string, input: unknown, title?: string) {
    if (title) {
        return title;
    }
    const subject = toolActivitySubject(toolName, input);
    return subject ?? `Used ${toolName}`;
}

function toolActivityDetail(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return record.command;
    }
    if ((toolName === 'read' || toolName === 'read_file') && typeof record.file_path === 'string') {
        return record.file_path;
    }
    return undefined;
}

function toolActivitySubject(toolName: string, input: unknown) {
    const record = isRecord(input) ? input : {};
    if (toolName === 'bash' && typeof record.command === 'string') {
        return 'terminal';
    }
    if ((toolName === 'read' || toolName === 'read_file') && typeof record.file_path === 'string') {
        return record.file_path;
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}
