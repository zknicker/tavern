import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentExecutor, AgentExecutorInput } from '../../runtime/src/tavern/agent-executor.ts';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const runtimeRoot = path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(path.join(runtimeRoot, 'agent', 'workspace'), { recursive: true });
writeFileSync(
    path.join(runtimeRoot, 'agent', 'workspace', 'QA_KICKOFF_TASK.md'),
    '# QA kickoff task\n\nThis file exists so e2e tool-read tests can inspect a deterministic workspace fixture.\n'
);

process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
process.env.TAVERN_AGENT_HOME = path.join(runtimeRoot, 'agent');
process.env.TAVERN_AGENT_WORKSPACE = path.join(runtimeRoot, 'agent', 'workspace');
process.env.TAVERN_RUNTIME_TOKEN = process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token';
process.env.NODE_ENV ??= 'test';

process.chdir(workspaceRoot);

const { setAgentExecutorForTesting } = await import(
    '../../runtime/src/tavern/agent-turn-runner.ts'
);
const chatApi = await import('../../runtime/src/tavern/chat-api/index.ts');
setAgentExecutorForTesting(createE2eAgentExecutor(chatApi));

// The runtime entry dispatches on argv and only starts the server on the `serve` subcommand.
process.argv = [process.argv[0] ?? 'bun', process.argv[1] ?? 'start-tavern-runtime.ts', 'serve'];

await import('../../runtime/src/index.ts');

function createE2eAgentExecutor(api: typeof chatApi): AgentExecutor {
    return {
        async execute(input) {
            const now = new Date().toISOString();
            const activityId = e2eActivityId(input.runId);
            const messageId = e2eMessageId(input.runId);
            const deliveryId = e2eDeliveryId(input.runId);
            const runtime = {
                agentId: input.agent.id,
                agentSessionId: input.agentSession.id,
                engine: 'agent-engine',
                messageId: input.requestMessageId,
                runId: input.runId,
                source: 'agent-engine',
            };

            api.upsertResponseActivity(input.chatId, input.responseId, {
                completed_at: now,
                detail: 'Generated a deterministic e2e agent response.',
                id: activityId,
                kind: 'message',
                metadata: { runtime },
                started_at: now,
                status: 'completed',
                title: 'E2E executor',
            });

            const receipt = api.createDelivery(input.chatId, {
                agent_id: input.agentSession.agentParticipantId,
                id: deliveryId,
                message: {
                    attachments: [],
                    author_id: input.agentSession.agentParticipantId,
                    content: e2eResponseContent(input),
                    id: messageId,
                    metadata: { runtime },
                    role: 'assistant',
                },
                metadata: { runtime },
                turn_id: input.runId,
            });

            api.upsertResponse(input.chatId, {
                completed_at: now,
                id: input.responseId,
                metadata: {
                    runtime: {
                        ...runtime,
                        completedAt: now,
                    },
                },
                participant_id: input.agentSession.agentParticipantId,
                request_message_id: input.requestMessageId,
                response_message_id: receipt.message.id,
                status: 'completed',
                summary: 'E2E executor completed.',
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

function e2eResponseContent(input: AgentExecutorInput) {
    const exactReply = parseExactReply(input.content);
    if (exactReply) {
        return exactReply;
    }
    const quoted = input.content.trim() || 'your message';
    return `${input.agent.name}: received "${quoted}".`;
}

function parseExactReply(content: string) {
    const quoted = content.match(/reply exactly\s+`([^`]+)`/iu);
    if (quoted?.[1]) {
        return quoted[1];
    }
    const bare = content.match(/reply exactly\s+([A-Z0-9_-]+)/iu);
    return bare?.[1] ?? null;
}

function e2eActivityId(runId: string) {
    return `act_${runId}_e2e_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function e2eDeliveryId(runId: string) {
    return `del_${runId}_e2e_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function e2eMessageId(runId: string) {
    return `msg_${runId}_e2e_executor`.replace(/[^A-Za-z0-9_-]/g, '_');
}
