import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    mapOpenClawGatewayEvent,
    openClawGatewaySubscriptionMethods,
    subscribeOpenClawAgentRuntimeEvents,
} from './events.ts';

describe('OpenClaw event mapping', () => {
    it('subscribes to the session gateway event stream', async () => {
        const requests: string[] = [];
        let closeHandler: (() => void) | null = null;
        let eventHandler: ((event: { event: string; payload: unknown }) => void) | null = null;
        let closed = false;

        const subscription = await subscribeOpenClawAgentRuntimeEvents(
            {
                gateway: {
                    close() {
                        closed = true;
                    },
                    async connect() {},
                    onClose(handler) {
                        closeHandler = handler;
                        return () => {
                            closeHandler = null;
                        };
                    },
                    onEvent(handler) {
                        eventHandler = handler;
                        return () => {
                            eventHandler = null;
                        };
                    },
                    async request<TPayload = unknown>(method: string): Promise<TPayload> {
                        requests.push(method);
                        return {} as TPayload;
                    },
                },
                gatewayUrl: 'ws://127.0.0.1:18789',
            },
            () => undefined
        );

        expect(requests).toEqual([...openClawGatewaySubscriptionMethods]);
        expect(typeof eventHandler).toBe('function');

        subscription.close();

        expect(closeHandler).toBeNull();
        expect(eventHandler).toBeNull();
        expect(closed).toBe(true);
    });

    it('only requests subscription methods that the shipped Gateway exposes', async () => {
        const methods = await loadShippedGatewayMethods();

        expect(methods.length).toBeGreaterThan(0);

        for (const method of openClawGatewaySubscriptionMethods) {
            expect(methods).toContain(method);
        }
    });

    it('maps session events to Tavern session invalidations', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'session.message',
            payload: {
                agentId: 'main',
                key: 'session:main',
                title: 'Main',
            },
        });

        expect(events[0]).toMatchObject({
            sessionKey: 'session:main',
            type: 'session.invalidated',
        });
    });

    it('maps Tavern Messenger session events without metadata', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'session.message',
            payload: {
                key: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                title: 'Blippy Tavern chat',
            },
        });

        expect(events[0]).toMatchObject({
            sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            type: 'session.invalidated',
        });
    });

    it('maps assistant session messages for non-Tavern sessions into visible reply updates', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'session.message',
            payload: {
                message: {
                    content: [
                        {
                            thinking: '',
                            type: 'thinking',
                        },
                        {
                            text: 'Contract check OK.',
                            type: 'text',
                        },
                    ],
                    role: 'assistant',
                    timestamp: 1_778_613_883_642,
                },
                messageId: 'message-1',
                session: {
                    key: 'agent:blippy:discord:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    startedAt: 1_778_613_883_497,
                },
                sessionKey: 'agent:blippy:discord:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
        });

        expect(events[0]).toMatchObject({
            isThinking: false,
            replace: true,
            text: 'Contract check OK.',
            turn: {
                agentId: 'blippy',
                chatId: 'channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'message-1',
                sessionKey: 'agent:blippy:discord:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            type: 'turn.replyUpdated',
        });
        expect(events[1]).toMatchObject({
            sessionKey: 'agent:blippy:discord:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            type: 'session.invalidated',
        });
    });

    it('does not map Tavern assistant session messages into duplicate live replies', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'session.message',
            payload: {
                message: {
                    content: [
                        {
                            text: 'Contract check OK.',
                            type: 'text',
                        },
                    ],
                    role: 'assistant',
                    timestamp: 1_778_613_883_642,
                },
                messageId: 'message-1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
        });

        expect(events).toEqual([
            expect.objectContaining({
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                type: 'session.invalidated',
            }),
        ]);
    });

    it('does not map empty Tavern chat completion events into completed turns', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'chat',
            payload: {
                message: {
                    content: [{ text: '', type: 'text' }],
                    role: 'assistant',
                    timestamp: 1_778_613_883_642,
                },
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                state: 'done',
            },
        });

        expect(events).toEqual([]);
    });

    it('maps cron events to Tavern cron events', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'cron',
            payload: {
                jobId: 'brief',
                runId: 'run_1',
                status: 'running',
            },
        });

        expect(events[0]).toMatchObject({
            cronJobId: 'brief',
            runId: 'run_1',
            type: 'cron.runStarted',
        });
    });

    it('maps Tavern Messenger chat final events to turn completion', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'chat',
            payload: {
                message: {
                    content: [
                        {
                            text: '⚠️ Model login failed on the gateway for openai.',
                            type: 'text',
                        },
                    ],
                    role: 'assistant',
                },
                metadata: {
                    tavern: {
                        chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    },
                },
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                state: 'final',
                timestamp: '2026-05-03T20:00:00.000Z',
            },
        });

        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({
            isThinking: false,
            replace: true,
            text: '⚠️ Model login failed on the gateway for openai.',
            turn: {
                agentId: 'main',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-03T20:00:00.000Z',
            },
            type: 'turn.replyUpdated',
        });
        expect(events[1]).toMatchObject({
            turn: {
                agentId: 'main',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-03T20:00:00.000Z',
            },
            type: 'turn.completed',
        });
    });

    it('maps Tavern Messenger plugin turn events directly', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'plugin.tavern.turn.started',
            payload: {
                agentId: 'blippy',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-04T12:00:00.000Z',
            },
        });

        expect(events[0]).toMatchObject({
            turn: {
                agentId: 'blippy',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            type: 'turn.started',
        });
    });

    it('maps OpenClaw session tool events to Tavern turn progress', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'session.tool',
            payload: {
                runId: 'run_1',
                seq: 3,
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-04T12:00:00.000Z',
                stream: 'tool',
                data: {
                    args: {
                        command: "sleep 5; printf 'done\\n'",
                    },
                    name: 'bash',
                    phase: 'start',
                    toolCallId: 'tool-call-1',
                },
            },
        });

        expect(events[0]).toMatchObject({
            step: {
                id: 'tool-call-1',
                kind: 'tool',
                label: "Used sleep 5; printf 'done\\n'",
                status: 'active',
            },
            turn: {
                agentId: 'blippy',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            type: 'turn.progress',
        });
        expect(events[1]).toMatchObject({
            sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            type: 'session.invalidated',
        });
    });

    it('maps OpenClaw command output events onto the same tool step id', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'agent',
            payload: {
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                stream: 'command_output',
                data: {
                    durationMs: 5030,
                    exitCode: 0,
                    name: 'bash',
                    phase: 'end',
                    status: 'completed',
                    title: '/bin/zsh -lc "sleep 5; printf \'done\\n\'"',
                    toolCallId: 'tool-call-1',
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            step: {
                detail: 'completed 5.0s',
                id: 'tool-call-1',
                kind: 'tool',
                label: 'Used /bin/zsh -lc "sleep 5; printf \'done\\n\'"',
                status: 'completed',
            },
            type: 'turn.progress',
        });
    });

    it('maps OpenClaw thinking events to reasoning progress with text', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'agent',
            payload: {
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                stream: 'thinking',
                data: {
                    text: 'Checking the current workspace before running tools.',
                },
            },
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            step: {
                detail: 'Checking the current workspace before running tools.',
                id: 'reasoning',
                kind: 'reasoning',
                label: 'Reasoning',
                status: 'active',
            },
            type: 'turn.progress',
        });
    });

    it('does not synthesize empty reasoning rows from item events', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'agent',
            payload: {
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                stream: 'item',
                data: {
                    itemId: 'reasoning-item-1',
                    kind: 'message',
                    phase: 'start',
                    status: 'running',
                    title: 'Reasoning',
                },
            },
        });

        expect(events).toEqual([]);
    });

    it('maps Tavern Messenger delivered replies into live reply updates', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'plugin.tavern.message.created',
            payload: {
                agentId: 'blippy',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-04T12:00:00.000Z',
                text: '⚠️ Model login failed on the gateway.',
            },
        });

        expect(events[0]).toMatchObject({
            isThinking: false,
            replace: true,
            text: '⚠️ Model login failed on the gateway.',
            turn: {
                agentId: 'blippy',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                startedAt: '2026-05-04T12:00:00.000Z',
            },
            type: 'turn.replyUpdated',
        });
    });

    it('maps chat error events to turn failures', () => {
        const events = mapOpenClawGatewayEvent({
            event: 'chat',
            payload: {
                agentId: 'main',
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                error: 'no model configured',
                runId: 'run_1',
                sessionKey: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                state: 'error',
            },
        });

        expect(events[0]).toMatchObject({
            error: 'no model configured',
            turn: {
                chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                runId: 'run_1',
            },
            type: 'turn.failed',
        });
    });
});

async function loadShippedGatewayMethods() {
    const distDir = path.join(findRepoRoot(), 'node_modules', 'openclaw', 'dist');
    const methodsFile = readdirSync(distDir).find((entry) =>
        entry.startsWith('server-methods-list-')
    );

    if (!methodsFile) {
        throw new Error('Unable to find the shipped OpenClaw server method list.');
    }

    const module = (await import(pathToFileURL(path.join(distDir, methodsFile)).href)) as Record<
        string,
        unknown
    >;
    const listMethods = Object.values(module).find(
        (value): value is () => string[] => typeof value === 'function'
    );

    if (!listMethods) {
        throw new Error('Unable to read the shipped OpenClaw server method list export.');
    }

    const methods = listMethods();

    if (!Array.isArray(methods)) {
        throw new Error('Shipped OpenClaw server method export did not return a method list.');
    }

    return methods;
}

function findRepoRoot() {
    let currentDirectory = process.cwd();

    while (true) {
        const candidate = path.join(currentDirectory, 'node_modules', 'openclaw', 'dist');
        if (existsSync(candidate)) {
            return currentDirectory;
        }

        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            throw new Error('Unable to find the repo root with the shipped OpenClaw package.');
        }

        currentDirectory = parentDirectory;
    }
}
