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
import type { ToolSet } from '@ai-sdk/provider-utils';
import type {
    AgentRuntimeModelName,
    AgentRuntimeThinkingLevel,
    TavernChatMessage,
} from '@tavern/api';
import { createLocalTrustedSandboxProvider } from '../agent-engine/local-trusted-sandbox.ts';
import {
    type AssignedSkillBundle,
    readAssignedSkillBundles,
} from '../agent-engine/skill-library.ts';
import { readConfigValue } from '../config.ts';
import { createTavernCronTools } from '../cron/agent-tools.ts';
import { isRuntimeCronReady } from '../cron/manager-state.ts';
import { log } from '../log.ts';
import { createTavernMemoryTools } from '../memory/agent-tools.ts';
import { recallTurnMemory } from '../memory/recall/recall.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import { createGoogleToolsForAgent } from '../plugins/google-tools.ts';
import { createMerchbaseToolsForAgent } from '../plugins/merchbase-tools.ts';
import { createTavernSkillTools } from '../skills/agent-tools.ts';
import { recordInjectedSkillUsage } from '../skills/telemetry.ts';
import { createTavernTaskTools } from '../tasks/agent-tools.ts';
import {
    parseWidgetsFromAssistantContent,
    widgetActivity,
    widgetActivityIdForRun,
} from '../widgets/render.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructions } from './agent-instructions.ts';
import { updateAgentSessionRuntimeState } from './agent-session-store.ts';
import { recordAgentTurnPromptEvidence } from './agent-turn-store.ts';
import {
    createDelivery,
    getChat,
    getMessage,
    listRecentMessagesBetween,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { createTavernChatTools } from './chat-context-tools.ts';
import { withRuntimeBridgeBootstrap } from './harness-bridge-bootstrap.ts';
import { assistantFinalAnswerPhase, persistHarnessTurnStream } from './harness-turn-stream.ts';
import { projectTavernMessageForAgent } from './mention-projection.ts';

export type { HarnessAssistantMessagePhase } from './harness-turn-stream.ts';

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

    const instructions = await buildAgentInstructions(input);
    const skills = await readHarnessAgentSkills(input);
    const recall = await recallTurnMemory(input.content);
    const prompt = harnessPrompt(input, recall?.block);
    try {
        recordAgentTurnPromptEvidence({
            evidence: {
                capturedAt: startedAt,
                instructions,
                prompt,
                recall: recall?.hits ?? [],
            },
            id: input.runId,
        });
    } catch (error) {
        log.warn('Turn prompt evidence was not recorded', { err: error, runId: input.runId });
    }
    const agent = harnessAgentFactory(input, createLocalTrustedSandboxProvider, {
        instructions,
        skills,
    });
    let session: HarnessAgentSession | undefined;
    let turnStream: Awaited<ReturnType<typeof persistHarnessTurnStream>>;
    let fallbackText = '';
    try {
        session = await agent.createSession({
            abortSignal,
            resumeFrom: input.agentSession.resumeState as
                | HarnessAgentResumeSessionState
                | undefined,
            sessionId: input.agentSession.runtimeSessionId ?? input.agentSession.id,
        });
        activeTurn.session = session;

        const turn = await agent.stream({
            abortSignal,
            prompt,
            session,
        });
        turnStream = await persistHarnessTurnStream(
            {
                chatId: input.chatId,
                model: input.agentSession.effectiveModel,
                responseId: input.responseId,
                runId: input.runId,
                runtime,
            },
            turn.fullStream
        );
        if (!turnStream.finalText) {
            fallbackText = (await turn.text).trim();
        }
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
    const activityIds = turnStream.activityIds;
    const responseContent = turnStream.finalText || fallbackText || emptyAssistantMessageDiagnostic;
    const parsedWidgets = parseWidgetsFromAssistantContent(responseContent);
    const messageContent = parsedWidgets?.displayContent ?? responseContent;
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
                    messagePhase: assistantFinalAnswerPhase,
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
    for (const [index, widget] of (parsedWidgets?.widgets ?? []).entries()) {
        const activityId = widgetActivityIdForRun(input.runId, index);
        upsertResponseActivity(
            input.chatId,
            input.responseId,
            widgetActivity({
                activityId,
                agentId: input.agent.id,
                messageId,
                runId: input.runId,
                sessionKey: input.agentSession.id,
                source: 'agent-engine',
                startedAt,
                timestamp: completedAt,
                widget,
            })
        );
        allActivityIds.push(activityId);
    }

    upsertResponse(input.chatId, {
        completed_at: completedAt,
        id: input.responseId,
        metadata: {
            runtime: {
                ...runtime,
                completedAt,
                ...(turnStream.contextTokens !== null
                    ? { contextTokens: turnStream.contextTokens }
                    : {}),
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

let harnessAgentFactory: typeof createHarnessAgent = createHarnessAgent;

export function setHarnessAgentFactoryForTesting(factory: typeof createHarnessAgent) {
    const previous = harnessAgentFactory;
    harnessAgentFactory = factory;
    return () => {
        harnessAgentFactory = previous;
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
    const tools = {
        ...createTavernChatTools({
            chatId: input.chatId,
        }),
        ...(isMemoryEnabled() ? createTavernMemoryTools() : {}),
        ...(isRuntimeCronReady() ? createTavernCronTools({ agentId: input.agent.id }) : {}),
        ...createTavernTaskTools({ agentId: input.agent.id }),
        ...createTavernSkillTools({ agentId: input.agent.id }),
        ...createGoogleToolsForAgent(input.agent),
        ...createMerchbaseToolsForAgent(input.agent),
    };
    return new HarnessAgent({
        harness,
        id: input.agent.id,
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: sandboxFactory(localTrustedSandboxOptions(input)),
        skills: options.skills,
        tools,
    });
}

export async function readHarnessAgentSkills(
    input: AgentExecutorInput,
    options: { skillsDir?: string } = {}
): Promise<HarnessAgentSkill[]> {
    const skills = await readAssignedSkillBundles(input.agent, options);
    recordInjectedSkillUsage({
        agentId: input.agent.id,
        skillIds: skills.filter((skill) => skill.path !== null).map((skill) => skill.id),
    });
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
    return createHarnessForModel({
        modelName: input.agentSession.effectiveModel,
        thinkingDefault: input.agent.thinkingDefault,
    });
}

export function createHarnessForModel(input: {
    modelName: AgentRuntimeModelName;
    thinkingDefault?: AgentRuntimeThinkingLevel | null;
}): HarnessV1<ToolSet> {
    const modelName = input.modelName;
    switch (modelName.provider) {
        case 'claude':
            return createClaudeCodeHarnessForRuntime({
                auth: claudeCodeAuthOptions(),
                maxTurns: 8,
                model: modelName.model,
                thinking: claudeThinking(input.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'codex':
            return createCodexHarnessForRuntime({
                model: modelName.model,
                reasoningEffort: codexReasoningEffort(input.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'openai':
        case 'openai-compatible': {
            const auth = piAuthOptions(modelName.provider);
            const thinkingLevel = piThinkingLevel(input.thinkingDefault);
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

export function createClaudeCodeHarnessForRuntime(
    settings: Parameters<typeof createClaudeCode>[0] = {}
) {
    return withRuntimeBridgeBootstrap(createClaudeCode(settings), 'claude-code');
}

export function createCodexHarnessForRuntime(settings: Parameters<typeof createCodex>[0] = {}) {
    return withRuntimeBridgeBootstrap(createCodex(settings), 'codex');
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

export function harnessPrompt(input: AgentExecutorInput, recallContext?: string | null) {
    const context = buildHarnessPromptContext(input);
    const sections = [
        'This turn:',
        `- current time: ${promptTimestamp(new Date().toISOString())}`,
        context.currentMessage
            ? `- triggering message: ${input.requestMessageId} (seq ${context.currentMessage.sequence})`
            : `- triggering message: ${input.requestMessageId}`,
    ];

    // First turn of a rotated session: no engine session exists yet, so prior
    // conversation is genuinely absent — say so instead of letting the model
    // guess. New seats (generation 1) get channel catch-up instead.
    if (!input.agentSession.runtimeSessionId && input.agentSession.generation > 1) {
        sections.push(
            '- This session just started fresh; earlier conversation is not in context. Use the chat tools or Memory if you need it.'
        );
    }

    if (recallContext) {
        sections.push('', recallContext);
    }

    if (context.ambientMessages.length > 0) {
        sections.push(
            '',
            'Channel messages since your last turn:',
            ...context.ambientMessages.map(formatPromptMessage)
        );
        if (context.ambientMessagesOmitted) {
            sections.push(
                `(${context.ambientMessages.length} most recent shown; use chat_messages_list or chat_messages_search for earlier.)`
            );
        }
    }

    if (context.replyContext) {
        sections.push('', 'Reply context:', formatPromptMessage(context.replyContext));
    }

    sections.push('', `New message for ${input.agent.name}:`, formatPromptMessageContent(input));

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
    return `[seq:${message.sequence} ${promptTimestamp(message.created_at)}] ${label}: ${message.content}`;
}

// Second precision keeps message envelopes short; milliseconds are noise.
function promptTimestamp(iso: string) {
    return iso.replace(/\.\d{3}Z$/, 'Z');
}

function formatPromptMessageContent(input: AgentExecutorInput) {
    const request = getMessage(input.requestMessageId);
    if (request) {
        const projectedContent = projectTavernMessageForAgent({
            content: request.content,
            enabledSkillIds: input.agent.enabledSkillIds,
        });
        return formatPromptMessage({ ...request, content: projectedContent });
    }
    return projectTavernMessageForAgent({
        content: input.content,
        enabledSkillIds: input.agent.enabledSkillIds,
    });
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

function sanitizeId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
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
