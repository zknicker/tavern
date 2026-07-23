import type { AgentRuntimeChatPaneState, ChatPaneTarget } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { createAgentParticipantId } from '../tavern/chat-api/ids.ts';
import { getChat } from '../tavern/chat-api/index.ts';
import { isAgentChatParticipant } from '../tavern/chat-guards.ts';
import { workspacePathExists } from '../workspace/files.ts';
import { publishPaneUpdated } from './events.ts';
import { openChatPaneTarget } from './store.ts';

export type OpenPaneTargetResult =
    | { ok: true; state: AgentRuntimeChatPaneState }
    | { ok: false; error: string };

// The one UI intent Runtime supports today: open or focus a target tab in a
// chat's artifact pane. Seat-gated and validated before anything persists;
// callers (the pane_open agent tool) surface the error string to the model.
// See specs/agent-app-control.md.
export async function openPaneTargetForAgent(input: {
    agentId: string;
    chatId: string;
    target: ChatPaneTarget;
}): Promise<OpenPaneTargetResult> {
    const chat = getChat(input.chatId);
    const participantId = createAgentParticipantId(input.agentId);
    if (!(chat && isAgentChatParticipant(chat, input.agentId, participantId))) {
        return { ok: false, error: 'You are not a participant of that chat.' };
    }

    const invalid = await validatePaneTarget(input.agentId, input.target);
    if (invalid) {
        return { ok: false, error: invalid };
    }

    const state = openChatPaneTarget(input.chatId, input.target);
    publishPaneUpdated(input.chatId, state.revision);
    return { ok: true, state };
}

async function validatePaneTarget(agentId: string, target: ChatPaneTarget): Promise<string | null> {
    switch (target.kind) {
        case 'workspaceFile': {
            const exists = await workspacePathExists(getDb(), {
                agentId,
                kind: 'file',
                path: target.path,
            });
            return exists ? null : `Workspace file "${target.path}" does not exist.`;
        }
        case 'workspaceDirectory':
        case 'workspaceRoot': {
            const exists = await workspacePathExists(getDb(), {
                agentId,
                kind: 'directory',
                path: target.path,
            });
            return exists ? null : `Workspace directory "${target.path}" does not exist.`;
        }
        default: {
            return 'Unsupported pane target.';
        }
    }
}
