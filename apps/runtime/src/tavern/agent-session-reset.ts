import fs from 'node:fs/promises';
import { getDb } from '../db/connection.ts';
import { registerAgentWorkspace } from '../workspace/instructions.ts';
import { startNewAgentSession } from './agent-session-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import {
    listChatsForAgentParticipant,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api/index.ts';

// Manual reset contract (specs/sessions.md): human-initiated, agent-scoped.
// "Session reset" starts a fresh global session; workspace and memory
// persist. "Full reset" also wipes the workspace. Restart needs no Runtime
// action — turns already resume the stored session as-is.

export type AgentResetKind = 'full' | 'session';

export async function resetAgentSession(input: {
    agentId: string;
    kind?: AgentResetKind;
    noticeText?: string;
}) {
    const kind = input.kind ?? 'session';
    if (kind === 'full') {
        await wipeAgentWorkspace(input.agentId);
    }
    const session = startNewAgentSession({ agentId: input.agentId });
    recordSessionResetNotice({
        agentId: input.agentId,
        sessionId: session.id,
        text:
            input.noticeText ??
            (kind === 'full'
                ? 'Started completely fresh: new session and an empty workspace.'
                : 'Started a fresh session. New messages start with fresh context.'),
    });
    return { session };
}

async function wipeAgentWorkspace(agentId: string) {
    const agent = getStoredAgent(agentId);
    if (!agent?.workspaceFolder) {
        return;
    }
    await fs.rm(agent.workspaceFolder, { force: true, recursive: true });
    await fs.mkdir(agent.workspaceFolder, { recursive: true });
    registerAgentWorkspace(getDb(), {
        agentId: agent.id,
        agentName: agent.name,
        workspaceDir: agent.workspaceFolder,
    });
}

// Evidence lands in the agent's built-in DM — the agent's home surface —
// since the reset is agent-scoped, not chat-scoped.
function recordSessionResetNotice(input: { agentId: string; sessionId: string; text: string }) {
    const participantId = createAgentParticipantId(input.agentId);
    const dm = listChatsForAgentParticipant(participantId).find((chat) => chat.kind === 'dm');
    if (!dm) {
        return;
    }
    const responseId = `rsp_session_${crypto.randomUUID()}`;
    const text = input.text;

    upsertResponse(dm.id, {
        id: responseId,
        metadata: { runtime: { agentId: input.agentId, source: 'session-reset' } },
        participant_id: participantId,
        status: 'completed',
    });
    upsertResponseActivity(dm.id, responseId, {
        detail: text,
        id: `act_${responseId}`,
        kind: 'custom',
        metadata: {
            runtime: {
                agentId: input.agentId,
                notice: {
                    detail: text,
                    id: 'runtime_notice_session_reset',
                    kind: 'new_session',
                    sessionId: input.sessionId,
                    text,
                    title: 'New session',
                },
                source: 'session-reset',
            },
        },
        status: 'completed',
        title: 'New session',
    });
}
