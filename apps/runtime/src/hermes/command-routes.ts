import type { AgentRuntimeCommandList } from '@tavern/api';
import { agentRuntimeRoutes, agentRuntimeRunCommandSchema } from '@tavern/api';
import { clearChat, upsertResponse, upsertResponseActivity } from '../tavern/chat-api';
import { createAgentChannelSessionKey, createAgentParticipantId } from '../tavern/chat-api/ids';
import { badRequest, json } from '../tavern/http';
import { createLocalHermesClient } from './local-client';
import { getSharedHermesClient } from './shared-client';

/**
 * Engine slash commands for the composer palette: list the categorized catalog
 * and run one command against the chat-bound agent session. Each run persists
 * as durable chat evidence. /new and /clear rotate the chat binding; /status
 * reports that binding without creating a fresh engine session. See
 * specs/composer-commands.md.
 */
export async function handleCommandsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.commands) {
        const client = createLocalHermesClient();
        try {
            return json(catalogForTavern(await client.listCommands()));
        } finally {
            client.close();
        }
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.commandsRun) {
        const payload = await request.json().catch(() => null);
        const parsed = agentRuntimeRunCommandSchema.safeParse(payload);
        if (!parsed.success) {
            return badRequest('Command run requires an agentId, chatId, and command.');
        }
        if (suppressedCommands.has(commandName(parsed.data.command))) {
            return badRequest('This command is not available in Tavern.');
        }

        return json(await runChatCommand(parsed.data));
    }

    return null;
}

// Engine commands hidden from Tavern, by rationale (the spec's "Suppressed"
// section is the contract):
// - terminal client / host machine: /busy /copy /debug /handoff /image
//   /indicator /paste /quit /redraw /skin /snapshot /statusbar /update
//   /verbose
// - session identity / history rewrite: /branch /resume /save /sessions
//   /title /undo
// - Tavern-owned subsystems and presentation: /footer /help /memory /voice
//   /yolo
// - depend on client-side turn resubmission or engine-initiated turns Tavern
//   does not ingest: /background /goal /queue /retry /steer /subgoal
const suppressedCommands = new Set([
    '/background',
    '/branch',
    '/busy',
    '/copy',
    '/debug',
    '/footer',
    '/goal',
    '/handoff',
    '/help',
    '/image',
    '/indicator',
    '/memory',
    '/paste',
    '/queue',
    '/quit',
    '/redraw',
    '/resume',
    '/retry',
    '/save',
    '/sessions',
    '/skin',
    '/snapshot',
    '/statusbar',
    '/steer',
    '/subgoal',
    '/title',
    '/undo',
    '/update',
    '/verbose',
    '/voice',
    '/yolo',
]);

// Tavern owns the chat-to-agent-session binding. These descriptions name the
// Tavern behavior even when the engine's catalog uses terminal-client wording.
const tavernCommandDescriptions: Record<string, string> = {
    '/clear': 'Clear the chat and start fresh context',
    '/new': 'Start fresh context without clearing the chat',
    '/status': "Show this chat's agent session status",
};

export function catalogForTavern(catalog: AgentRuntimeCommandList): AgentRuntimeCommandList {
    return {
        commands: catalog.commands
            .filter((command) => !suppressedCommands.has(command.name))
            .map((command) => ({
                ...command,
                description:
                    tavernCommandDescriptions[command.name] ??
                    presentEngineDescription(command.description),
            })),
    };
}

// Engine catalog descriptions are user-facing copy; the engine name and its
// install paths are implementation details (Coding Rule 11).
export function presentEngineDescription(description: string | null): string | null {
    if (!description) {
        return description;
    }

    return description
        .replace(/~\/\.hermes\/skills\/?/giu, "the agent's skills directory")
        .replace(/~\/\.hermes\b/giu, "the agent engine's home")
        .replace(/hermes agent/giu, 'agent engine')
        .replace(/\bhermes\b/giu, 'the agent');
}

async function runChatCommand(input: { agentId: string; chatId: string; command: string }) {
    const command = input.command.trim();
    const name = commandName(command);

    if (name === '/clear' || name === '/new') {
        return await resetTavernSession(
            { ...input, command },
            { clearTimeline: name === '/clear' }
        );
    }

    const sessionKey = createAgentChannelSessionKey(input.agentId, input.chatId);
    const client = getSharedHermesClient();

    if (name === '/status') {
        const output = formatSessionBindingStatus(await client.getSessionBindingStatus(sessionKey));
        recordCommandRun({ ...input, command, output, status: 'completed' });
        return { output, status: 'completed' as const };
    }

    try {
        const result = await client.runCommand(sessionKey, command);
        recordCommandRun({
            ...input,
            command,
            output: result.output,
            status: 'completed',
        });
        return result;
    } catch (error) {
        const output = error instanceof Error ? error.message : 'Command failed.';
        recordCommandRun({ ...input, command, output, status: 'failed' });
        return { output, status: 'failed' as const };
    }
}

// /new and /clear are the commands Tavern reinterprets: reset the session
// (fresh engine session under the same synced session key); /clear also
// dismisses everything currently in the timeline. The session reset runs
// first so a failure never hides history without actually starting fresh.
async function resetTavernSession(
    input: { agentId: string; chatId: string; command: string },
    options: { clearTimeline: boolean }
) {
    const client = getSharedHermesClient();
    const sessionKey = createAgentChannelSessionKey(input.agentId, input.chatId);

    try {
        await client.resetSession(sessionKey);
        const output = options.clearTimeline
            ? clearedChatOutput(clearChat(input.chatId))
            : 'Started a fresh session. New messages start with fresh context.';
        recordCommandRun({ ...input, output, status: 'completed' });
        return { output, status: 'completed' as const };
    } catch (error) {
        const output = error instanceof Error ? error.message : 'Command failed.';
        recordCommandRun({ ...input, output, status: 'failed' });
        return { output, status: 'failed' as const };
    }
}

function formatSessionBindingStatus(input: {
    liveSessionId: string | null;
    model?: { model: string; provider: string } | null;
    sessionKey: string;
    state: string;
    storedSessionId: string | null;
    updatedAt: string | null;
}) {
    const state =
        input.state === 'live'
            ? 'Active live session'
            : input.state === 'bound'
              ? 'Linked; not currently live'
              : 'No linked session yet';
    const lines = [
        'Agent Session Status',
        '',
        `State: ${state}`,
        `Model: ${input.model?.model ?? 'unknown'} (${input.model?.provider ?? 'unknown'})`,
        `Session key: ${input.sessionKey}`,
    ];

    if (input.storedSessionId) {
        lines.push(`Bound session: ${input.storedSessionId}`);
    }
    if (input.liveSessionId) {
        lines.push(`Live session: ${input.liveSessionId}`);
    }
    if (input.updatedAt) {
        lines.push(`Binding updated: ${input.updatedAt}`);
    }
    if (input.state === 'empty') {
        lines.push('Next message or session command will start a session.');
    }

    return lines.join('\n');
}

function clearedChatOutput(cleared: { messages_deleted: number; responses_deleted: number }) {
    const hidden = cleared.messages_deleted + cleared.responses_deleted;
    return `Chat cleared (${hidden} ${hidden === 1 ? 'entry' : 'entries'} hidden). New messages start with fresh context.`;
}

function commandName(command: string) {
    return (command.trim().split(/\s/u, 1)[0] ?? '').toLowerCase();
}

// Evidence writes happen after the run settles so the timeline never shows a
// phantom in-flight turn for a command.
function recordCommandRun(input: {
    agentId: string;
    chatId: string;
    command: string;
    output: string;
    status: 'completed' | 'failed';
}) {
    const responseId = `rsp_cmd_${crypto.randomUUID()}`;

    upsertResponse(input.chatId, {
        id: responseId,
        metadata: { runtime: { agentId: input.agentId, source: 'command' } },
        participant_id: createAgentParticipantId(input.agentId),
        status: input.status,
    });
    upsertResponseActivity(input.chatId, responseId, {
        detail: input.output,
        id: `act_${responseId}`,
        kind: 'command',
        metadata: { command: { status: input.status, text: input.command } },
        status: input.status,
        title: input.command.split(/\s/u, 1)[0] ?? input.command,
    });
}
