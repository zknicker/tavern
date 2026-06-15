import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { createChat, listResponses } from '../tavern/chat-api';
import {
    catalogForTavern,
    handleCommandsRequest,
    presentEngineDescription,
} from './command-routes';
import { closeSharedHermesClient } from './shared-client';

const hermesClient = vi.hoisted(() => ({
    close: vi.fn(),
    getSessionBindingStatus: vi.fn(async () => ({
        liveSessionId: 'live-session',
        sessionKey: 'agent:agt_hermes:tavern:channel:cht_1',
        state: 'live',
        storedSessionId: 'stored-session',
        updatedAt: '2026-06-14T00:00:00.000Z',
    })),
    listCommands: vi.fn(async () => ({ commands: [] })),
    resetSession: vi.fn(async () => undefined),
    runCommand: vi.fn(async () => ({
        output: 'command output',
        status: 'completed' as const,
    })),
}));

vi.mock('./local-client', () => ({
    createLocalHermesClient: () => hermesClient,
}));

describe('Tavern command catalog policy', () => {
    it('hides terminal-client and host-machine commands', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/status'),
                command('/copy'),
                command('/paste'),
                command('/image'),
                command('/quit'),
                command('/redraw'),
                command('/skin'),
                command('/indicator'),
                command('/statusbar'),
                command('/busy'),
                command('/verbose'),
                command('/snapshot'),
                command('/handoff'),
                command('/update'),
                command('/model'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/status', '/model']);
    });

    it('hides session-identity, history-rewrite, and replaced-subsystem commands', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/undo'),
                command('/resume'),
                command('/sessions'),
                command('/branch'),
                command('/title'),
                command('/save'),
                command('/memory'),
                command('/yolo'),
                command('/footer'),
                command('/voice'),
                command('/help'),
                command('/debug'),
                command('/status'),
                command('/compress'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/status', '/compress']);
    });

    it('hides commands that need client-side turn resubmission or invisible turns', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/retry'),
                command('/queue'),
                command('/steer'),
                command('/background'),
                command('/goal'),
                command('/subgoal'),
                command('/stop'),
                command('/agents'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/stop', '/agents']);
    });

    it('presents /clear and /new as Tavern session resets', () => {
        const catalog = catalogForTavern({
            commands: [
                {
                    category: 'Session',
                    description: 'Clear screen and start a new session',
                    name: '/clear',
                },
                {
                    category: 'Session',
                    description: 'Start a new session (fresh session ID + history)',
                    name: '/new',
                },
            ],
        });

        expect(catalog.commands).toEqual([
            {
                category: 'Session',
                description: 'Clear the chat and start fresh context',
                name: '/clear',
            },
            {
                category: 'Session',
                description: 'Start fresh context without clearing the chat',
                name: '/new',
            },
        ]);
    });

    it('presents /status as a Tavern binding read', () => {
        const catalog = catalogForTavern({
            commands: [
                {
                    category: 'Session',
                    description: 'Show Hermes CLI status',
                    name: '/status',
                },
            ],
        });

        expect(catalog.commands).toEqual([
            {
                category: 'Session',
                description: "Show this chat's agent session status",
                name: '/status',
            },
        ]);
    });

    it('keeps the engine name and install paths out of command descriptions', () => {
        const catalog = catalogForTavern({
            commands: [
                {
                    category: 'Tools & Skills',
                    description: 'Re-scan ~/.hermes/skills/ for newly installed or removed skills',
                    name: '/reload-skills',
                },
                {
                    category: 'Configuration',
                    description: 'Pick the personality Hermes uses for this session',
                    name: '/personality',
                },
                {
                    category: 'Info',
                    description: 'Show Hermes Agent version',
                    name: '/version',
                },
            ],
        });

        expect(catalog.commands.map((entry) => entry.description)).toEqual([
            "Re-scan the agent's skills directory for newly installed or removed skills",
            'Pick the personality the agent uses for this session',
            'Show agent engine version',
        ]);
    });

    it('passes empty descriptions through untouched', () => {
        expect(presentEngineDescription(null)).toBeNull();
        expect(presentEngineDescription('Show session info')).toBe('Show session info');
    });
});

describe('Tavern command execution policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureRuntimeSchema(initTestDb());
        createChat({ id: 'cht_1' });
    });

    afterEach(() => {
        closeSharedHermesClient();
        closeDb();
    });

    it('runs ordinary engine commands through the shared chat client', async () => {
        const response = await runCommand('/model gpt-5.5');
        const body = (await response.json()) as { output: string; status: string };

        expect(body).toEqual({ output: 'command output', status: 'completed' });
        expect(hermesClient.runCommand).toHaveBeenCalledWith(
            'agent:agt_hermes:tavern:channel:cht_1',
            '/model gpt-5.5'
        );
        expect(hermesClient.close).not.toHaveBeenCalled();
        expect(commandActivity()).toMatchObject({
            detail: 'command output',
            title: '/model',
        });
    });

    it('resets the shared chat binding for /new', async () => {
        const response = await runCommand('/new');
        const body = (await response.json()) as { output: string; status: string };

        expect(body).toEqual({
            output: 'Started a fresh session. New messages start with fresh context.',
            status: 'completed',
        });
        expect(hermesClient.resetSession).toHaveBeenCalledWith(
            'agent:agt_hermes:tavern:channel:cht_1'
        );
        expect(hermesClient.runCommand).not.toHaveBeenCalled();
    });

    it('reports /status without creating or resuming an engine session', async () => {
        const response = await runCommand('/status');
        const body = (await response.json()) as { output: string; status: string };

        expect(body.status).toBe('completed');
        expect(body.output).toContain('Agent Session Status');
        expect(body.output).toContain('Bound session: stored-session');
        expect(body.output).toContain('Live session: live-session');
        expect(hermesClient.getSessionBindingStatus).toHaveBeenCalledWith(
            'agent:agt_hermes:tavern:channel:cht_1'
        );
        expect(hermesClient.runCommand).not.toHaveBeenCalled();
        expect(hermesClient.resetSession).not.toHaveBeenCalled();
    });
});

function command(name: string) {
    return { category: 'Session', description: null, name };
}

async function runCommand(commandText: string) {
    const response = await handleCommandsRequest(
        new Request('http://runtime.test/commands/run', {
            body: JSON.stringify({
                agentId: 'agt_hermes',
                chatId: 'cht_1',
                command: commandText,
            }),
            method: 'POST',
        })
    );
    if (!response) {
        throw new Error('Command request was not handled.');
    }
    return response;
}

function commandActivity() {
    const response = listResponses('cht_1').responses[0];
    if (!response) {
        throw new Error('Missing command response.');
    }
    return listResponses('cht_1').activity.find((activity) => activity.response_id === response.id);
}
