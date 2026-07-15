import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { setModelProviderEnabled } from '../models/provider-store.ts';
import type { AgentExecutor, AgentExecutorInput } from '../tavern/agent-executor.ts';
import { resetAgentExecutorForTesting } from '../tavern/agent-turn-runner.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import {
    createChat,
    createDelivery,
    upsertResponse,
    upsertResponseActivity,
} from '../tavern/chat-api/index.ts';
import type { RuntimeCronManager } from './scheduler.ts';

export function setupCronTestLifecycle() {
    const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
    const jobsDirs: string[] = [];
    let jobsDir: string;
    let manager: RuntimeCronManager | null = null;

    beforeEach(async () => {
        jobsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-cron-'));
        jobsDirs.push(jobsDir);
        manager = null;
        ensureRuntimeSchema(initTestDb());
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
        await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
        resetAgentExecutorForTesting();
    });

    afterEach(async () => {
        vi.useRealTimers();
        await manager?.stop();
        manager = null;
        resetAgentExecutorForTesting();
        closeDb();
        restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
    });

    afterAll(async () => {
        await Promise.all(jobsDirs.map((dir) => fs.rm(dir, { force: true, recursive: true })));
    });

    return {
        jobsDbPath() {
            return path.join(jobsDir, 'jobs.sqlite');
        },
        setManager(nextManager: RuntimeCronManager | null) {
            manager = nextManager;
        },
        async stopManager() {
            await manager?.stop();
            manager = null;
        },
        testQueueName() {
            return `tavern-cron-${path.basename(jobsDir)}`;
        },
    };
}

export function createAgentChat(...agentIds: string[]) {
    for (const agentId of agentIds) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: agentId,
                isAdmin: false,
                name: agentId,
                primaryColor: null,
                workspaceFolder: `/tmp/${agentId}`,
            },
        });
    }

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
            ...agentIds.map((agentId) => ({
                id: agentId,
                kind: 'agent' as const,
                label: agentId,
                metadata: { agentId },
            })),
        ],
        title: 'General',
    });
}

export function createFakeAgentExecutor(): AgentExecutor {
    return {
        async execute(input) {
            const now = new Date().toISOString();
            const activityId = `act_${input.runId}_fake_executor`;
            const messageId = `msg_${input.runId}_fake_executor`;
            const deliveryId = `del_${input.runId}_fake_executor`;
            const runtime = {
                agentId: input.agent.id,
                agentSessionId: input.agentSession.id,
                engine: 'agent-engine',
                messageId: input.requestMessageId,
                runId: input.runId,
                source: 'agent-engine',
            };
            upsertResponseActivity(input.chatId, input.responseId, {
                completed_at: now,
                detail: 'Generated a deterministic fake agent response.',
                id: activityId,
                kind: 'message',
                metadata: { runtime },
                started_at: now,
                status: 'completed',
                title: 'Fake executor',
            });
            const receipt = createDelivery(input.chatId, {
                agent_id: input.agentParticipantId,
                id: deliveryId,
                message: {
                    attachments: [],
                    author_id: input.agentParticipantId,
                    content: fakeResponseContent(input),
                    id: messageId,
                    metadata: { runtime },
                    role: 'assistant',
                },
                metadata: { runtime },
                turn_id: input.runId,
            });
            upsertResponse(input.chatId, {
                completed_at: now,
                id: input.responseId,
                metadata: { runtime: { ...runtime, completedAt: now } },
                participant_id: input.agentParticipantId,
                request_message_id: input.requestMessageId,
                response_message_id: receipt.message.id,
                status: 'completed',
                summary: 'Fake executor completed.',
            });
            return {
                activityIds: [activityId],
                outputMessageIds: [receipt.message.id],
            };
        },
        stop() {
            return true;
        },
    };
}

export async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for cron assertion.');
}

export function jsonRequest(pathname: string, body: unknown, method = 'POST') {
    return new Request(`http://runtime.test${pathname}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}

export function getRequest(pathname: string, method = 'GET') {
    return new Request(`http://runtime.test${pathname}`, { method });
}

export function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }
    process.env[name] = value;
}

function fakeResponseContent(input: AgentExecutorInput) {
    return `${input.agent.name}: received "${input.content}".`;
}
