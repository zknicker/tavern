import type { AgentRuntimeCommand, AgentRuntimeCommandList } from '@tavern/api';
import { agentRuntimeRoutes, agentRuntimeRunCommandSchema } from '@tavern/api';
import {
    ensureCurrentAgentSession,
    readCurrentAgentSession,
    startNewAgentSession,
} from '../tavern/agent-session-store';
import { clearChat, upsertResponse, upsertResponseActivity } from '../tavern/chat-api';
import { createAgentParticipantId } from '../tavern/chat-api/ids';
import { badRequest, json } from '../tavern/http';
import { ensurePrimaryManagedAgent } from '../tavern/managed-agent';

/**
 * Engine slash commands for the composer palette: list the categorized catalog
 * and run one command against the chat-bound agent session. Each run persists
 * as durable chat evidence. /new and /clear rotate the current Agent session;
 * /status reports that Agent seat without creating a fresh session. See
 * specs/composer-commands.md.
 */
export async function handleCommandsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.commands) {
        return json(localCommandCatalog());
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

// Tavern owns chat-bound Agent sessions. These descriptions name the Tavern
// behavior even when the engine's catalog uses terminal-client wording.
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

export function presentEngineDescription(description: string | null): string | null {
    return description;
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

    if (name === '/status') {
        const output = formatAgentSessionStatus(resolveTavernAgentSession(input));
        recordCommandRun({ ...input, command, output, status: 'completed' });
        return { output, status: 'completed' as const };
    }

    const output = `Command ${name || command} is not available in this agent.`;
    recordCommandRun({ ...input, command, output, status: 'failed' });
    return { output, status: 'failed' as const };
}

// /new and /clear are the commands Tavern reinterprets: start a fresh current
// Agent session for the same Agent seat. /clear also dismisses everything
// currently in the timeline. The session reset runs first so a failure never
// hides history without actually starting fresh.
async function resetTavernSession(
    input: { agentId: string; chatId: string; command: string },
    options: { clearTimeline: boolean }
) {
    ensurePrimaryManagedAgent();
    startNewAgentSession({
        agentParticipantId: createAgentParticipantId(input.agentId),
        chatId: input.chatId,
    });
    const output = options.clearTimeline
        ? clearedChatOutput(clearChat(input.chatId))
        : 'Started a fresh session. New messages start with fresh context.';
    recordCommandRun({ ...input, output, status: 'completed' });
    return { output, status: 'completed' as const };
}

function localCommandCatalog(): AgentRuntimeCommandList {
    return {
        commands: [
            command('/status', "Show this chat's agent session status"),
            command('/clear', 'Clear the chat and start fresh context'),
            command('/new', 'Start fresh context without clearing the chat'),
        ],
    };
}

function command(name: string, description: string): AgentRuntimeCommand {
    return { category: 'Commands', description, name };
}

function formatAgentSessionStatus(input: {
    engineSessionId: string | null;
    generation: number | null;
    sessionId: string | null;
    state: 'active' | 'archived' | 'empty' | 'stopped';
    updatedAt: string | null;
}) {
    const state =
        input.state === 'active'
            ? 'Active'
            : input.state === 'archived'
              ? 'Archived'
              : input.state === 'stopped'
                ? 'Stopped'
                : 'No Agent session yet';
    const lines = ['Agent Session Status', '', `State: ${state}`];

    if (input.sessionId) {
        lines.push(`Session: ${input.sessionId}`);
    }
    if (input.generation) {
        lines.push(`Generation: ${input.generation}`);
    }
    if (input.engineSessionId) {
        lines.push(`Engine session: ${input.engineSessionId}`);
    }
    if (input.updatedAt) {
        lines.push(`Session updated: ${input.updatedAt}`);
    }
    if (input.state === 'empty') {
        lines.push('Next addressed message or session command will start a session.');
    }

    return lines.join('\n');
}

function resolveTavernAgentSession(input: { agentId: string; chatId: string }): {
    engineSessionId: string | null;
    generation: number | null;
    sessionId: string | null;
    state: 'active' | 'archived' | 'empty' | 'stopped';
    updatedAt: string | null;
} {
    ensurePrimaryManagedAgent();
    const session =
        readCurrentAgentSession({
            agentParticipantId: createAgentParticipantId(input.agentId),
            chatId: input.chatId,
        }) ??
        ensureCurrentAgentSession({
            agentParticipantId: createAgentParticipantId(input.agentId),
            chatId: input.chatId,
        });
    return {
        engineSessionId: session?.runtimeSessionId ?? null,
        generation: session?.generation ?? null,
        sessionId: session?.id ?? null,
        state: session?.status ?? 'empty',
        updatedAt: session?.updatedAt ?? null,
    };
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
