import { prepareAgentEngineInstructions } from '../agent-engine/instructions.ts';
import { isRuntimeCronReady } from '../cron/manager-state.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { getStoredAgent } from './agents-store.ts';
import { getChat } from './chat-api/index.ts';

export interface BuildAgentInstructionOptions {
    db?: Database;
    seedSkills?: boolean;
    skillsDir?: string;
}

export async function buildAgentInstructions(
    input: AgentExecutorInput,
    options: BuildAgentInstructionOptions = {}
) {
    const prepared = await prepareAgentEngineInstructions(options.db ?? getDb(), input.agent, {
        seedSkills: options.seedSkills,
        skillsDir: options.skillsDir,
    });
    return [prepared.content, tavernChatInstructions(input)].join('\n\n');
}

// Static per-session guidance lives here instead of the per-turn prompt so a
// long session carries one copy in its system prompt rather than one per turn.
function tavernChatInstructions(input: AgentExecutorInput) {
    return [
        'This chat:',
        ...chatIdentityLines(input),
        '- Every prompt message carries its send time. Weigh timestamps against the current time; treat older context and prior data reads as stale until re-checked.',
        '- Recalled Memory blocks are automatic background context, not user input; verify with memory_read_page before relying on details.',
        '',
        'Chat tools:',
        '- chat_messages_list: list current-chat messages by sequence cursor',
        '- chat_messages_search: search current-chat messages',
        '- chat_message_get: read one current-chat message by id',
        ...(isMemoryEnabled()
            ? [
                  '',
                  'Memory tools (shared durable knowledge):',
                  '- memory_search: search shared Memory pages — check before assuming you lack context on something the user references',
                  '- memory_list_pages: list shared Memory pages and folders',
                  '- memory_read_page: read one shared Memory page with its hash',
                  '- memory_write_page: write one shared Memory page (explicit user-requested Memory work only)',
              ]
            : []),
        ...(isRuntimeCronReady()
            ? [
                  '',
                  'Automation tools:',
                  '- cron_list: list your scheduled automations',
                  '- cron_create: schedule your message into a chat after confirming schedule and chat with the user',
                  '- cron_update: update one of your scheduled automations',
                  '- cron_delete: delete one of your scheduled automations',
              ]
            : []),
    ].join('\n');
}

// The agent should know where it is speaking: channel vs direct message, the
// chat's name, and who else holds a seat — including which seat is its own.
function chatIdentityLines(input: AgentExecutorInput) {
    const chat = getChat(input.chatId);
    if (!chat) {
        return [`- chatId: ${input.chatId}`];
    }

    const kind =
        chat.kind === 'dm'
            ? 'a direct message between you and the user'
            : `the "${chat.title}" channel`;
    const participants = chat.participants
        .map((participant) => {
            if (participant.id === input.agentSession.agentParticipantId) {
                return `${participant.label ?? input.agent.name} (you)`;
            }
            if (participant.kind === 'agent') {
                const agentId = participantAgentId(participant.metadata);
                const name =
                    participant.label ??
                    (agentId ? (getStoredAgent(agentId)?.name ?? null) : null) ??
                    participant.id;
                return `${name} (agent)`;
            }
            return participant.label ?? participant.id;
        })
        .join(', ');

    return [`- This is ${kind}.`, `- chatId: ${input.chatId}`, `- Participants: ${participants}`];
}

function participantAgentId(metadata: Record<string, unknown>) {
    const agentId = metadata.agentId;
    return typeof agentId === 'string' && agentId.length > 0 ? agentId : null;
}
