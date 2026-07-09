import { existsSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentSession,
    AgentRuntimeModelName,
} from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveCliCommand } from '../agent-engine/cli-command.ts';
import { readConfigValue } from '../config.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { defaultClaudeModel, defaultCodexModel, defaultOpenAiModel } from '../models/contracts.ts';
import { saveAgentModelSelectionIntent } from '../models/selection-service.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import { createAgentTurn } from './agent-turn-store.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage, getMessage, getResponse, upsertResponse } from './chat-api';
import { createHarnessAgentExecutor } from './harness-agent-executor.ts';

// Real-provider smoke lane. Opt in with `TAVERN_SMOKE=1 bun run test:smoke`.
// Each provider case additionally skips itself when its CLI or credentials
// are missing, so the lane never fails on a machine that cannot run that
// provider. An available provider that errors is a real failure — that is
// the breakage this lane exists to catch.
const smokeOptIn = process.env.TAVERN_SMOKE === '1';

const smokeToken = 'SMOKE_OK';
const smokePrompt = `Connectivity check. Reply with exactly ${smokeToken} and nothing else.`;

interface ProviderSmokeCase {
    available: () => boolean;
    model: AgentRuntimeModelName;
    requirement: string;
}

const providerCases: ProviderSmokeCase[] = [
    {
        available: () =>
            Boolean(readConfigValue('TAVERN_AGENT_API_KEY') ?? readConfigValue('OPENAI_API_KEY')),
        model: { model: defaultOpenAiModel, provider: 'openai' },
        requirement: 'an OpenAI API key (OPENAI_API_KEY or TAVERN_AGENT_API_KEY)',
    },
    {
        available: () =>
            Boolean(
                resolveCliCommand(readConfigValue('TAVERN_AGENT_CLAUDE_CODE_COMMAND') ?? 'claude')
            ),
        model: { model: defaultClaudeModel, provider: 'claude' },
        requirement: 'the claude CLI with a logged-in subscription',
    },
    {
        available: () =>
            Boolean(
                resolveCliCommand(readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex')
            ) && existsSync(path.join(os.homedir(), '.codex', 'auth.json')),
        model: { model: defaultCodexModel, provider: 'codex' },
        requirement: 'the codex CLI with ~/.codex/auth.json',
    },
];

describe.skipIf(!smokeOptIn)('harness provider smoke (TAVERN_SMOKE=1)', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    for (const providerCase of providerCases) {
        const { model } = providerCase;
        it.skipIf(smokeOptIn && !providerCase.available())(
            `${model.provider}/${model.model} completes a real turn (needs ${providerCase.requirement})`,
            async () => {
                const chatId = `cht_smoke_${model.provider}`;
                seedSmokeDm(chatId, model);
                const requestMessageId = `msg_smoke_${model.provider}`;
                createMessage(chatId, {
                    author_id: 'usr_smoke',
                    content: smokePrompt,
                    id: requestMessageId,
                    role: 'user',
                });

                const input = smokeExecutorInput({ chatId, model, requestMessageId });
                expect(input.agentSession.effectiveModel).toEqual(model);
                upsertResponse(chatId, {
                    id: input.responseId,
                    participant_id: 'agt_primary',
                    request_message_id: requestMessageId,
                    status: 'running',
                    summary: 'Working on it.',
                });
                createAgentTurn({
                    agentId: 'agt_primary',
                    agentParticipantId: 'agt_primary',
                    agentSessionId: input.agentSession.id,
                    chatId,
                    id: input.runId,
                    responseId: input.responseId,
                    triggerMessageId: requestMessageId,
                });

                const result = await createHarnessAgentExecutor().execute(input);

                expect(result.outputMessageIds).toHaveLength(1);
                const reply = getMessage(result.outputMessageIds[0] ?? '');
                expect(reply?.content ?? '').toContain(smokeToken);
                expect(getResponse(input.responseId)?.status).toBe('completed');
            }
        );
    }
});

function seedSmokeDm(chatId: string, model: AgentRuntimeModelName) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: '.tavern/agents/agt_primary/workspace',
        },
        syncedAt: new Date().toISOString(),
    });
    saveAgentModelSelectionIntent({ agentId: 'agt_primary', modelName: model });
    createChat({
        id: chatId,
        kind: 'dm',
        participants: [
            { id: 'usr_smoke', kind: 'user', label: 'Smoke', metadata: {} },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: chatId,
    });
}

function smokeExecutorInput(input: {
    chatId: string;
    model: AgentRuntimeModelName;
    requestMessageId: string;
}) {
    const workspaceFolder = mkdtempSync(path.join(os.tmpdir(), 'tavern-smoke-'));
    const agentSession = ensureCurrentAgentSession({
        agentParticipantId: 'agt_primary',
        chatId: input.chatId,
    }) satisfies AgentRuntimeAgentSession;
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder,
        } satisfies AgentRuntimeAgent,
        agentSession,
        attachments: [],
        chatId: input.chatId,
        content: smokePrompt,
        requestMessageId: input.requestMessageId,
        responseId: `rsp_smoke_${input.model.provider}`,
        runId: `run_smoke_${input.model.provider}`,
    };
}
