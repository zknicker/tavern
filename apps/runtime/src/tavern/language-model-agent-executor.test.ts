import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { LanguageModelV4GenerateResult, LanguageModelV4Usage } from '@ai-sdk/provider';
import type { AgentRuntimeAgent } from '@tavern/api';
import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import {
    createChat,
    createMessage,
    getResponse,
    getResponseActivity,
    listEvents,
    listMessages,
    upsertResponse,
} from './chat-api/index.ts';
import {
    createLanguageModelAgentExecutor,
    createLanguageModelAgentExecutorWithConfig,
} from './language-model-agent-executor.ts';

const now = '2026-06-29T12:00:00.000Z';
const liveOpenAiSmoke =
    process.env.TAVERN_OPENAI_LIVE_SMOKE === '1' &&
    Boolean(process.env.OPENAI_API_KEY || process.env.TAVERN_AGENT_API_KEY);
const usage = {
    inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 12, total: 12 },
    outputTokens: { reasoning: undefined, text: 4, total: 4 },
    raw: { completion_tokens: 4, prompt_tokens: 12, total_tokens: 16 },
} satisfies LanguageModelV4Usage;

describe('language-model agent executor', () => {
    let workspaceFolder: string;

    beforeEach(() => {
        workspaceFolder = '';
        ensureRuntimeSchema(initTestDb());
        seedAgentChat();
    });

    afterEach(async () => {
        closeDb();
        if (workspaceFolder) {
            await fs.rm(workspaceFolder, { force: true, recursive: true });
        }
    });

    it('completes an OpenAI language-model turn as durable Tavern chat state', async () => {
        const model = new MockLanguageModelV4({
            doGenerate: generatedText('OpenAI-backed reply.'),
            modelId: 'gpt-4.1-mini',
            provider: 'openai',
        });
        const executor = createLanguageModelAgentExecutorWithConfig({
            resolveConfig: async (input) => ({
                model: model as unknown as LanguageModel,
                modelId: input?.modelName?.model ?? 'gpt-4.1-mini',
                provider: 'openai',
                wrapTools: (tools) => tools,
            }),
        });

        const result = await executor.execute(executorInput());

        expect(result).toEqual({
            activityIds: [],
            outputMessageIds: ['msg_run_1_assistant'],
        });
        expect(getResponse('rsp_run_1')).toMatchObject({
            participant_id: 'agt_primary',
            request_message_id: 'msg_1',
            response_message_id: 'msg_run_1_assistant',
            status: 'completed',
        });
        expect(getResponseActivity('act_run_1_language_model')).toBeNull();
        expect(listMessages('cht_general').messages.map((message) => message.content)).toEqual([
            'hello openai',
            'OpenAI-backed reply.',
        ]);
        expect(listEvents().events.map((event) => event.type)).toEqual([
            'message.created',
            'response.created',
            'message.delivered',
            'response.completed',
        ]);
    });

    it('executes Runtime tools through the AI SDK loop and stores tool activity', async () => {
        workspaceFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-agent-tools-'));
        await fs.writeFile(
            path.join(workspaceFolder, 'QA_KICKOFF_TASK.md'),
            'TOOL_CALL_OK',
            'utf8'
        );
        const model = new MockLanguageModelV4({
            doGenerate: [
                generatedToolCall({
                    input: { path: 'QA_KICKOFF_TASK.md' },
                    toolCallId: 'call_read_fixture',
                    toolName: 'read_file',
                }),
                generatedText('Read the workspace fixture: TOOL_CALL_OK.'),
            ],
            modelId: 'gpt-4.1-mini',
            provider: 'openai',
        });
        const executor = createLanguageModelAgentExecutorWithConfig({
            resolveConfig: async (input) => ({
                model: model as unknown as LanguageModel,
                modelId: input?.modelName?.model ?? 'gpt-4.1-mini',
                provider: 'openai',
                wrapTools: (tools) => tools,
            }),
        });

        const result = await executor.execute(executorInput({ workspaceFolder }));

        expect(result.activityIds).toContain('act_run_1_tool_call_read_fixture');
        expect(model.doGenerateCalls).toHaveLength(2);
        expect(
            model.doGenerateCalls[0]?.tools?.map((toolDefinition) => toolDefinition.name)
        ).toEqual(['bash', 'read_file']);
        expect(getResponseActivity('act_run_1_tool_call_read_fixture')).toMatchObject({
            detail: 'QA_KICKOFF_TASK.md',
            kind: 'tool_call',
            response_id: 'rsp_run_1',
            status: 'completed',
            title: 'QA_KICKOFF_TASK.md',
        });
        expect(getResponseActivity('act_run_1_tool_call_read_fixture')?.metadata).toMatchObject({
            tool: {
                arguments: { path: 'QA_KICKOFF_TASK.md' },
                name: 'read_file',
                result: {
                    content: 'TOOL_CALL_OK',
                    path: path.join(workspaceFolder, 'QA_KICKOFF_TASK.md'),
                },
            },
            toolCallId: 'call_read_fixture',
            toolName: 'read_file',
        });
        expect(listMessages('cht_general').messages.map((message) => message.content)).toEqual([
            'hello openai',
            'Read the workspace fixture: TOOL_CALL_OK.',
        ]);
    });

    (liveOpenAiSmoke ? it : it.skip)(
        'completes a real OpenAI API-key turn when live smoke is enabled',
        async () => {
            createMessage('cht_general', {
                author_id: 'usr_tavern',
                content: 'Reply exactly PRD11_OPENAI_OK.',
                id: 'msg_live',
                role: 'user',
            });
            upsertResponse('cht_general', {
                id: 'rsp_run_live',
                metadata: {},
                participant_id: 'agt_primary',
                request_message_id: 'msg_live',
                status: 'running',
            });

            const result = await createLanguageModelAgentExecutor().execute(
                executorInput({
                    requestMessageId: 'msg_live',
                    responseId: 'rsp_run_live',
                    runId: 'run_live',
                })
            );

            expect(result.outputMessageIds).toEqual(['msg_run_live_assistant']);
            expect(getResponse('rsp_run_live')).toMatchObject({
                response_message_id: 'msg_run_live_assistant',
                status: 'completed',
            });
            expect(
                listMessages('cht_general').messages.find(
                    (message) => message.id === 'msg_run_live_assistant'
                )?.content
            ).toContain('PRD11_OPENAI_OK');
        },
        30_000
    );
});

function generatedText(text: string): LanguageModelV4GenerateResult {
    return {
        content: [{ text, type: 'text' }],
        finishReason: { raw: 'stop', unified: 'stop' },
        usage,
        warnings: [],
    };
}

function generatedToolCall(input: {
    input: Record<string, unknown>;
    toolCallId: string;
    toolName: string;
}): LanguageModelV4GenerateResult {
    return {
        content: [
            {
                input: JSON.stringify(input.input),
                toolCallId: input.toolCallId,
                toolName: input.toolName,
                type: 'tool-call',
            },
        ],
        finishReason: { raw: 'tool-calls', unified: 'tool-calls' },
        usage,
        warnings: [],
    };
}

function seedAgentChat() {
    createChat({
        id: 'cht_general',
        kind: 'channel',
        participants: [
            {
                id: 'usr_tavern',
                kind: 'user',
                label: 'You',
                metadata: {},
            },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Agent',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: 'General',
    });
    createMessage('cht_general', {
        author_id: 'usr_tavern',
        content: 'hello openai',
        id: 'msg_1',
        role: 'user',
    });
    upsertResponse('cht_general', {
        id: 'rsp_run_1',
        metadata: {
            runtime: {
                agentId: 'agt_primary',
                agentSessionId: 'ags_cht_general_agt_primary_1',
                engine: 'agent-engine',
                messageId: 'msg_1',
                runId: 'run_1',
                source: 'agent-engine',
            },
        },
        participant_id: 'agt_primary',
        request_message_id: 'msg_1',
        status: 'running',
    });
}

function executorInput(
    overrides: {
        requestMessageId?: string;
        responseId?: string;
        runId?: string;
        workspaceFolder?: string;
    } = {}
): AgentExecutorInput {
    const runId = overrides.runId ?? 'run_1';
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: false,
            modelName: { model: 'gpt-4.1-mini', provider: 'openai' },
            name: 'Agent',
            primaryColor: null,
            workspaceFolder: overrides.workspaceFolder ?? '/tmp/agt_primary',
        } satisfies AgentRuntimeAgent,
        agentSession: {
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            archivedAt: null,
            chatId: 'cht_general',
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_cht_general_agt_primary_1',
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        },
        attachments: [],
        chatId: 'cht_general',
        content: 'hello openai',
        requestMessageId: overrides.requestMessageId ?? 'msg_1',
        responseId: overrides.responseId ?? 'rsp_run_1',
        runId,
    };
}
