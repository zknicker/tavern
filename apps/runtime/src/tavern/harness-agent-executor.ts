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
import type { AgentRuntimeModelName, AgentRuntimeThinkingLevel } from '@tavern/api';
import { createLocalTrustedSandboxProvider } from '../agent-engine/local-trusted-sandbox.ts';
import {
    type AssignedSkillBundle,
    readAssignedSkillBundles,
} from '../agent-engine/skill-library.ts';
import { readConfigValue } from '../config.ts';
import { createTavernCronTools } from '../cron/agent-tools.ts';
import { isRuntimeCronReady } from '../cron/manager-state.ts';
import { createImageGenerationTools } from '../images/agent-tools.ts';
import { log } from '../log.ts';
import { imageGenerationReadiness } from '../models/capability-selections.ts';
import { createBrowserToolsForAgent } from '../plugins/browser-tools.ts';
import { createGoogleToolsForAgent } from '../plugins/google-tools.ts';
import { createMerchbaseToolsForAgent } from '../plugins/merchbase-tools.ts';
import { createTavernSkillTools } from '../skills/agent-tools.ts';
import { recordInjectedSkillUsage } from '../skills/telemetry.ts';
import { createTavernTaskTools } from '../tasks/agent-tools.ts';
import { createWebToolsForAgent } from '../web/agent-tools.ts';
import {
    parseWidgetsFromAssistantContent,
    widgetActivity,
    widgetActivityIdForRun,
} from '../widgets/render.ts';
import { createTavernWikiTools } from '../wiki/agent-tools.ts';
import { recallTurnWiki } from '../wiki/recall/recall.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructionBundle } from './agent-instructions.ts';
import {
    recordAgentSessionInstructionsHash,
    updateAgentSessionRuntimeState,
} from './agent-session-store.ts';
import { recordAgentTurnPromptEvidence } from './agent-turn-store.ts';
import { createTavernChatActionTools } from './chat-actions-tools.ts';
import {
    createDelivery,
    deleteMessage,
    getMessage,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';
import { createTavernChatTools } from './chat-context-tools.ts';
import { createTavernChatWaitTools } from './chat-wait-idle-tool.ts';
import { recordFreshnessHoldNotice, resolveFreshnessHold } from './freshness-gate.ts';
import { withRuntimeBridgeBootstrap } from './harness-bridge-bootstrap.ts';
import { harnessPrompt, promptCursorSequence } from './harness-prompt.ts';
import {
    assistantFinalAnswerPhase,
    assistantMessageIdForRun,
    persistHarnessTurnStream,
} from './harness-turn-stream.ts';
import { createTavernPaneTools } from './pane-tools.ts';
import { advanceSeenCursor } from './seen-ledger.ts';

export type { HarnessAssistantMessagePhase } from './harness-turn-stream.ts';

const emptyAssistantMessageDiagnostic = 'No reply: the model returned empty content.';
// A reply of exactly this token is a sanctioned silent turn: the assistant
// turn stays in session history, but nothing is delivered to the chat.
const silentReplyToken = 'NO_REPLY';

interface ActiveHarnessTurn {
    controller: AbortController;
    session?: HarnessAgentSession;
}

export function createHarnessAgentExecutor(): AgentExecutor {
    const active = new Map<string, ActiveHarnessTurn>();

    return {
        async deliverUserMessage(runId, text) {
            const session = active.get(runId)?.session;
            if (!session) {
                return false;
            }
            try {
                return await session.sendUserMessage(text);
            } catch {
                return false;
            }
        },
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

    const { fingerprint, instructions } = await buildAgentInstructionBundle(input);
    // Harness adapters frame instructions into a session's first prompt and
    // drop them on resumed turns, so only non-resume turns deliver them.
    const instructionsDelivered = !input.agentSession.resumeState;
    const skills = await readHarnessAgentSkills(input);
    const recall = await recallTurnWiki(input.content);
    const prompt = harnessPrompt(input, recall?.block);
    try {
        recordAgentTurnPromptEvidence({
            evidence: {
                capturedAt: startedAt,
                instructions,
                instructionsDelivered,
                prompt,
                recall: recall?.hits ?? [],
            },
            id: input.runId,
        });
    } catch (error) {
        log.warn('Turn prompt evidence was not recorded', { err: error, runId: input.runId });
    }
    if (instructionsDelivered) {
        recordAgentSessionInstructionsHash({ hash: fingerprint, id: input.agentSession.id });
    }
    const agent = harnessAgentFactory(input, createLocalTrustedSandboxProvider, {
        instructions,
        skills,
    });
    let session: HarnessAgentSession | undefined;
    let turnStream: Awaited<ReturnType<typeof persistHarnessTurnStream>>;
    let fallbackText = '';
    try {
        const sessionId = input.agentSession.runtimeSessionId ?? input.agentSession.id;
        const resumeFrom = input.agentSession.resumeState as
            | HarnessAgentResumeSessionState
            | undefined;
        try {
            session = await agent.createSession({ abortSignal, resumeFrom, sessionId });
        } catch (error) {
            if (!resumeFrom) {
                throw error;
            }
            // A stored session can predate sandbox or work-directory changes;
            // continuing fresh beats failing the turn.
            log.warn('Agent session resume failed; starting a fresh session', {
                err: error,
                runId: input.runId,
            });
            session = await agent.createSession({ abortSignal, sessionId });
        }
        activeTurn.session = session;

        const streamTarget = {
            authorId: input.agentParticipantId,
            chatId: input.chatId,
            model: input.agentSession.effectiveModel,
            responseId: input.responseId,
            runId: input.runId,
            runtime,
        };
        const turn = await agent.stream({
            abortSignal,
            prompt,
            session,
        });
        turnStream = await persistHarnessTurnStream(streamTarget, turn.fullStream);
        if (!turnStream.finalText) {
            fallbackText = (await turn.text).trim();
        }
        // Freshness gate (specs/steering.md): hold a stale channel reply
        // once, show the rows that landed mid-turn, and let the agent
        // deliver, revise, or decline before anything durable ships.
        const draft = turnStream.finalText || fallbackText;
        const hold =
            draft && draft !== silentReplyToken ? resolveFreshnessHold(input, draft) : null;
        if (hold) {
            recordFreshnessHoldNotice(input, hold);
            const heldTurn = await agent.stream({
                abortSignal,
                prompt: hold.prompt,
                session,
            });
            const heldStream = await persistHarnessTurnStream(streamTarget, heldTurn.fullStream);
            const revised = heldStream.finalText || (await heldTurn.text).trim();
            turnStream = {
                activityIds: [...turnStream.activityIds, ...heldStream.activityIds],
                contextTokens: heldStream.contextTokens ?? turnStream.contextTokens,
                finalText: revised || draft,
            };
            fallbackText = '';
        }
        const resumeState = await session.stop();
        activeTurn.session = undefined;
        updateAgentSessionRuntimeState({
            id: input.agentSession.id,
            resumeState: resumeState as Record<string, unknown>,
            runtimeSessionId: session.sessionId,
        });
        // The prompt's catch-up and trigger are now model-visible: advance
        // the trigger chat's seen cursor (specs/sessions.md).
        advanceSeenCursor({
            chatId: input.chatId,
            seq: promptCursorSequence(input),
            sessionId: input.agentSession.id,
        });
    } catch (error) {
        activeTurn.session = undefined;
        await session?.destroy().catch(() => {});
        throw formatHarnessExecutionError(input, error);
    }

    const completedAt = new Date().toISOString();
    const activityIds = turnStream.activityIds;
    const responseContent = turnStream.finalText || fallbackText || emptyAssistantMessageDiagnostic;
    if (responseContent === silentReplyToken) {
        return completeSilentHarnessTurn(input, {
            activityIds,
            completedAt,
            contextTokens: turnStream.contextTokens,
            runtime,
            startedAt,
        });
    }
    const parsedWidgets = parseWidgetsFromAssistantContent(responseContent);
    const messageContent = parsedWidgets?.displayContent ?? responseContent;
    const messageId = assistantMessageIdForRun(input.runId);
    const deliveryId = deliveryIdForRun(input.runId);
    const receipt = createDelivery(input.chatId, {
        agent_id: input.agentParticipantId,
        id: deliveryId,
        message: {
            attachments: [],
            author_id: input.agentParticipantId,
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
        participant_id: input.agentParticipantId,
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

// A silent turn completes without a delivery: no assistant message lands in
// the chat, and the response row plus one activity row remain as evidence
// that the agent read the message and chose not to reply.
function completeSilentHarnessTurn(
    input: AgentExecutorInput,
    turn: {
        activityIds: string[];
        completedAt: string;
        contextTokens: number | null;
        runtime: Record<string, unknown>;
        startedAt: string;
    }
) {
    const activityId = silentReplyActivityIdForRun(input.runId);
    // A silent reply leaves no timeline unit: retract the streaming post if
    // narration already created one (specs/chat-timeline.md).
    const postId = assistantMessageIdForRun(input.runId);
    if (getMessage(postId)) {
        deleteMessage(postId);
    }
    upsertResponseActivity(input.chatId, input.responseId, {
        completed_at: turn.completedAt,
        id: activityId,
        kind: 'custom',
        metadata: {
            runtime: { ...turn.runtime, model: input.agentSession.effectiveModel },
        },
        started_at: turn.startedAt,
        status: 'completed',
        summary: 'Read the message and chose not to reply.',
        title: 'Chose not to reply',
    });
    upsertResponse(input.chatId, {
        completed_at: turn.completedAt,
        id: input.responseId,
        metadata: {
            runtime: {
                ...turn.runtime,
                completedAt: turn.completedAt,
                ...(turn.contextTokens !== null ? { contextTokens: turn.contextTokens } : {}),
                model: input.agentSession.effectiveModel,
            },
        },
        participant_id: input.agentParticipantId,
        request_message_id: input.requestMessageId,
        status: 'completed',
        summary: 'Chose not to reply.',
    });

    return {
        activityIds: [...turn.activityIds, activityId],
        outputMessageIds: [],
    };
}

export function silentReplyActivityIdForRun(runId: string) {
    return `act_${sanitizeId(runId)}_silent_reply`;
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
            agentId: input.agent.id,
            chatId: input.chatId,
        }),
        ...createTavernChatActionTools({
            agentId: input.agent.id,
            chatId: input.chatId,
            runId: input.runId,
            sessionId: input.agentSession.id,
        }),
        ...createTavernChatWaitTools({
            agentId: input.agent.id,
            chatId: input.chatId,
            runId: input.runId,
        }),
        ...createTavernWikiTools(),
        ...createTavernPaneTools({ agentId: input.agent.id, chatId: input.chatId }),
        ...(isRuntimeCronReady() ? createTavernCronTools({ agentId: input.agent.id }) : {}),
        ...(imageGenerationReadiness().ready
            ? createImageGenerationTools({ workspaceFolder: input.agent.workspaceFolder })
            : {}),
        ...createTavernTaskTools({ agentId: input.agent.id, chatId: input.chatId }),
        ...createTavernSkillTools({ agentId: input.agent.id }),
        ...createGoogleToolsForAgent(input.agent),
        ...createMerchbaseToolsForAgent(input.agent),
        ...createBrowserToolsForAgent(input.agent),
        ...createWebToolsForAgent(input.agent),
    };
    return new HarnessAgent({
        harness,
        id: input.agent.id,
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: sandboxFactory(localTrustedSandboxOptions(input)),
        // Sessions work at the workspace root itself: the sandbox anchors at
        // the workspace's parent and workDir names the workspace folder, so
        // the composed session work directory IS the workspace. The harness
        // default (an invisible per-session directory) hides agent files from
        // workspace browsing, the artifact panel, and task materialization.
        sandboxConfig: { workDir: path.basename(input.agent.workspaceFolder) },
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

// Anchored one level above the workspace so the session work directory
// (rootDir + sandboxConfig.workDir) resolves to the workspace root itself.
function localTrustedSandboxOptions(input: AgentExecutorInput) {
    const rootDir = path.dirname(input.agent.workspaceFolder);
    if (input.agentSession.effectiveModel.provider !== 'codex') {
        return { rootDir };
    }
    const homeDir = path.join(input.agent.workspaceFolder, '.home');
    return {
        authProfiles: ['codex'] as const,
        env: {
            CODEX_HOME: path.join(homeDir, '.codex'),
            HOME: homeDir,
        },
        homeDir,
        rootDir,
    };
}

function createHarness(input: AgentExecutorInput): HarnessV1<ToolSet> {
    return createHarnessForModel({
        modelName: input.agentSession.effectiveModel,
        thinkingDefault: input.agent.thinkingDefault,
        webSearch: input.agent.webAccessEnabled === true,
    });
}

export function createHarnessForModel(input: {
    modelName: AgentRuntimeModelName;
    thinkingDefault?: AgentRuntimeThinkingLevel | null;
    webSearch?: boolean;
}): HarnessV1<ToolSet> {
    const modelName = input.modelName;
    switch (modelName.provider) {
        case 'claude':
            return createClaudeCodeHarnessForRuntime({
                auth: claudeCodeAuthOptions(),
                // Native WebFetch stays disallowed even with web access on:
                // web_fetch is the uniform Tavern fetch tool across providers,
                // so page reads keep one size-cap and injection posture.
                disallowedTools: input.webSearch ? ['WebFetch'] : ['WebSearch', 'WebFetch'],
                maxTurns: 8,
                model: modelName.model,
                thinking: claudeThinking(input.thinkingDefault),
            }) as HarnessV1<ToolSet>;
        case 'codex':
            return createCodexHarnessForRuntime({
                model: modelName.model,
                reasoningEffort: codexReasoningEffort(input.thinkingDefault),
                ...(input.webSearch ? { webSearch: true } : {}),
            }) as HarnessV1<ToolSet>;
        case 'openai':
        case 'openai-compatible': {
            const auth = piAuthOptions(modelName.provider);
            const thinkingLevel = piThinkingLevel(input.thinkingDefault);
            return createPi({
                ...(auth ? { auth } : {}),
                model: piModelId(modelName),
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

// Pi rejects bare model ids that exist under several providers (gpt-4.1-mini
// also ships as azure-openai-responses), so OpenAI routes must use the
// canonical provider/model reference.
function piModelId(model: AgentRuntimeModelName) {
    return model.provider === 'openai' ? `openai/${model.model}` : model.model;
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
