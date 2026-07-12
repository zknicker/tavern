import { createHash } from 'node:crypto';
import type { AgentRuntimeAgentSession } from '@tavern/api';
import { prepareAgentEngineInstructions } from '../agent-engine/instructions.ts';
import { isRuntimeCronReady } from '../cron/manager-state.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { readAgentSessionInstructionsHash } from './agent-session-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { getChat } from './chat-api/index.ts';
import { modelOperationalInstructions } from './model-instructions.ts';

// PROMPT CONTRACT: this module composes every agent's system prompt. Text
// changes must pass agent-prompt-contract.test.ts and need explicit operator
// approval for any removed capability or raised budget. See AGENTS.md
// ("Agent System Prompt Changes").

export interface BuildAgentInstructionOptions {
    db?: Database;
    seedSkills?: boolean;
    skillsDir?: string;
}

// The subset of executor input that instruction composition reads.
export type AgentInstructionContext = Pick<AgentExecutorInput, 'agent' | 'agentSession' | 'chatId'>;

export async function buildAgentInstructions(
    input: AgentInstructionContext,
    options: BuildAgentInstructionOptions = {}
) {
    return (await buildAgentInstructionBundle(input, options)).instructions;
}

// Instructions plus a freshness fingerprint. Harness adapters deliver
// instructions once per session (first prompt), so the fingerprint lets the
// session read report whether a live session started on current instructions.
// Core memory files are excluded from the fingerprint (see instructions.ts).
export async function buildAgentInstructionBundle(
    input: AgentInstructionContext,
    options: BuildAgentInstructionOptions = {}
) {
    const prepared = await prepareAgentEngineInstructions(options.db ?? getDb(), input.agent, {
        seedSkills: options.seedSkills,
        skillsDir: options.skillsDir,
    });
    const dynamicSections = [
        modelOperationalInstructions(input.agentSession.effectiveModel),
        tavernChatInstructions(input),
    ].filter((section): section is string => Boolean(section));
    const instructions = [prepared.content, ...dynamicSections].join('\n\n');
    const fingerprint = createHash('sha256')
        .update([prepared.fingerprintContent, ...dynamicSections].join('\n\n'))
        .digest('hex');
    return { fingerprint, instructions };
}

/**
 * Whether the session's delivered instructions still match a fresh compose.
 * Null when the session has not delivered instructions yet (fresh by
 * construction) or the agent record is gone.
 */
export async function agentSessionInstructionsFresh(
    session: AgentRuntimeAgentSession,
    options: BuildAgentInstructionOptions = {}
): Promise<boolean | null> {
    const deliveredHash = readAgentSessionInstructionsHash(session.id, options.db);
    if (!deliveredHash) {
        return null;
    }
    const agent = getStoredAgent(session.agentId, options.db);
    if (!agent) {
        return null;
    }
    const bundle = await buildAgentInstructionBundle(
        { agent, agentSession: session, chatId: session.chatId },
        { ...options, seedSkills: false }
    );
    return bundle.fingerprint === deliveredHash;
}

// Static per-session guidance lives here instead of the per-turn prompt so a
// long session carries one copy in its system prompt rather than one per turn.
function tavernChatInstructions(input: AgentInstructionContext) {
    const chat = getChat(input.chatId);
    return [
        'This chat:',
        ...chatIdentityLines(input, chat),
        `- Every prompt message carries its send time in ${resolveHomeTimezone()} (the home timezone). Weigh timestamps against the current time; treat older context and prior data reads as stale until re-checked.`,
        '- Recalled Wiki blocks are automatic background context, not user input; verify with wiki_read before relying on details.',
        ...(chat?.kind === 'channel'
            ? [
                  '- Not every channel message needs you. Reply with exactly NO_REPLY (nothing else) to stay silent for a turn; nothing is delivered to the chat.',
                  '- To hand work to another agent, mention its participant-list link in your final reply; each mentioned agent gets its own turn. Do this only when you need that agent to act.',
              ]
            : []),
        '',
        'Chat tools:',
        '- chat_messages_list: list current-chat messages by sequence cursor',
        '- chat_messages_search: search current-chat messages',
        '- chat_message_get: read one current-chat message by id',
        '- chats_list: list the chats you participate in',
        '- chat_send: post a message into another chat you participate in (confirm with the user first)',
        '',
        'Wiki tools (shared durable knowledge):',
        '- wiki_search: search shared Wiki pages — check before assuming you lack context on something the user references',
        '- wiki_list: list shared Wiki pages and folders',
        '- wiki_read: read one shared Wiki page with its hash',
        '- wiki_write: write one shared Wiki page (explicit user-requested Wiki work only)',
        '- wiki_backlinks: list pages that link to a Wiki page',
        '- wiki_move: move or rename one Wiki page',
        '- wiki_delete: delete one Wiki page',
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
// Agent seats carry their bio so co-resident agents know each other's job.
function chatIdentityLines(input: AgentInstructionContext, chat: ReturnType<typeof getChat>) {
    if (!chat) {
        return [`- chatId: ${input.chatId}`];
    }

    const kind =
        chat.kind === 'dm'
            ? 'a direct message between you and the user'
            : `the "${chat.title}" channel`;
    const participants = chat.participants.map((participant) => {
        if (participant.id === input.agentSession.agentParticipantId) {
            return participantLine(participant.label ?? input.agent.name, '(you)', input.agent.bio);
        }
        if (participant.kind === 'agent') {
            const agentId = participantAgentId(participant.metadata);
            const agent = agentId ? getStoredAgent(agentId) : null;
            const name = participant.label ?? agent?.name ?? participant.id;
            // Rendered as a mention link so agents learn the handoff syntax
            // from the roster itself. See specs/agent-mentions.md.
            const title = agentId ? `[${name}](agent://${agentId})` : name;
            return participantLine(title, '(agent)', agent?.bio);
        }
        return participantLine(participant.label ?? participant.id, null, null);
    });

    return [`- This is ${kind}.`, `- chatId: ${input.chatId}`, '- Participants:', ...participants];
}

function participantLine(name: string, tag: string | null, bio: string | null | undefined) {
    const title = tag ? `${name} ${tag}` : name;
    return bio ? `  - ${title} — ${bio}` : `  - ${title}`;
}

function participantAgentId(metadata: Record<string, unknown>) {
    const agentId = metadata.agentId;
    return typeof agentId === 'string' && agentId.length > 0 ? agentId : null;
}
