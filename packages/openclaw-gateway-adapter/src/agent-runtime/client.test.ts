import { describe, expect, it } from 'bun:test';
import { parseAgentRuntimeModelRef } from '@tavern/api';
import type { OpenClawGatewayClient, OpenClawGatewayEventHandler } from '../gateway/types.ts';
import { openClawGatewaySample } from '../test-data/openclaw-gateway-sample.ts';
import { createOpenClawAgentRuntimeClient } from './client.ts';

describe('OpenClaw agent runtime client', () => {
    it('does not project Tavern sessions into the OpenClaw chat list', async () => {
        const gateway = new FakeGateway({
            'sessions.list': {
                sessions: [
                    {
                        key: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        sessionId: 'tavern-session',
                    },
                ],
            },
        });
        const client = createOpenClawAgentRuntimeClient({
            gateway,
            gatewayUrl: 'ws://sample',
        });

        const result = await client.listChats();

        expect(result.chats).toEqual([]);
        expect(gateway.requests.map((request) => request.method)).toEqual(['sessions.list']);
    });

    it('uses OpenClaw Gateway admin params for file and skill reads', async () => {
        const gateway = new FakeGateway({
            'agents.files.get': openClawGatewaySample.agentFileGet,
            'skills.detail': openClawGatewaySample.skillDetail,
            'skills.status': openClawGatewaySample.skills,
        });
        const client = createOpenClawAgentRuntimeClient({
            gateway,
            gatewayUrl: 'ws://sample',
        });

        await client.getAgentFile('main', '/openclaw/workspace/theclaw/AGENTS.md');
        const skill = await client.getSkillConfig('1password');

        expect(skill.contentMarkdown).toBe('# 1Password\nUse the CLI.');
        expect(gateway.requests).toEqual([
            {
                method: 'agents.files.get',
                params: { agentId: 'main', name: 'AGENTS.md' },
            },
            {
                method: 'skills.status',
                params: undefined,
            },
            {
                method: 'skills.detail',
                params: { slug: '1password' },
            },
        ]);
    });

    it('posts Tavern chat messages through native OpenClaw chat.send', async () => {
        const gateway = new FakeGateway({
            'chat.send': {
                runId: 'run_1',
            },
        });
        const client = createOpenClawAgentRuntimeClient({
            gateway,
            gatewayUrl: 'ws://sample',
        });

        const accepted = await client.postMessage('cht_1', {
            agent: { agentId: 'blippy' },
            message: {
                content: 'hello',
                id: 'msg_1',
            },
            target: {
                externalId: 'cht_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_1',
                target: 'chat:cht_1',
                type: 'tavern',
            },
        });

        expect(accepted).toMatchObject({
            runId: 'run_1',
            sessionKey: 'agent:blippy:tavern:channel:cht_1',
            status: 'accepted',
        });
        expect(gateway.requests).toEqual([
            {
                method: 'chat.send',
                params: {
                    deliver: false,
                    idempotencyKey: 'run_1',
                    message: 'hello',
                    sessionKey: 'agent:blippy:tavern:channel:cht_1',
                },
            },
        ]);
    });

    it('walks cron run pages until OpenClaw reports the snapshot is complete', async () => {
        const run = openClawGatewaySample.cronRuns.entries[0];
        const gateway = new FakeGateway({
            'cron.runs': [
                {
                    entries: [run],
                    hasMore: true,
                    nextOffset: 1,
                },
                {
                    entries: [
                        {
                            ...run,
                            sessionId: 'second-session',
                            sessionKey:
                                'agent:tiny:cron:d3292360-3ce0-4331-a917-e7eaba948886:run:second-session',
                        },
                    ],
                    hasMore: false,
                    nextOffset: null,
                },
            ],
        });
        const client = createOpenClawAgentRuntimeClient({
            gateway,
            gatewayUrl: 'ws://sample',
        });

        const runs = await client.listCronRuns('d3292360-3ce0-4331-a917-e7eaba948886');

        expect(runs.runs.map((mappedRun) => mappedRun.sessionId)).toEqual([
            '39e6406f-9730-43d5-8973-0f575f36dbc4',
            'second-session',
        ]);
        expect(gateway.requests).toEqual([
            {
                method: 'cron.runs',
                params: { id: 'd3292360-3ce0-4331-a917-e7eaba948886' },
            },
            {
                method: 'cron.runs',
                params: { id: 'd3292360-3ce0-4331-a917-e7eaba948886', offset: 1 },
            },
        ]);
    });

    it('saves one explicit agent model name and harness through OpenClaw Gateway', async () => {
        const primaryModel = parseAgentRuntimeModelRef('codex/gpt-5.5');
        const gateway = new FakeGateway({
            'config.apply': {},
            'config.get': {
                hash: 'config-hash-1',
                raw: JSON.stringify({
                    agents: {
                        list: [
                            {
                                id: 'blippy',
                                name: 'Blippy',
                            },
                        ],
                    },
                }),
            },
            'models.list': openClawGatewaySample.models,
        });
        const client = createOpenClawAgentRuntimeClient({
            gateway,
            gatewayUrl: 'ws://sample',
        });

        await client.saveModels({
            agents: [
                {
                    agentId: 'blippy',
                    fallbackModels: [],
                    isOverridden: true,
                    openClawModelName: {
                        harness: 'codex',
                        model: 'gpt-5.5',
                        provider: 'openai',
                    },
                    primaryModel,
                    subAgentModel: null,
                },
            ],
            configuredModels: [primaryModel],
            defaults: {
                fallbackModels: [],
                primaryModel: null,
            },
            defaultsThinkingLevel: null,
            subAgentDefaultModel: null,
            subAgentThinkingLevel: null,
        });

        expect(gateway.requests).toEqual([
            {
                method: 'config.get',
                params: undefined,
            },
            {
                method: 'models.list',
                params: undefined,
            },
            {
                method: 'config.apply',
                params: {
                    baseHash: 'config-hash-1',
                    raw: JSON.stringify({
                        agents: {
                            list: [
                                {
                                    id: 'blippy',
                                    name: 'Blippy',
                                    model: {
                                        fallbacks: [],
                                        primary: 'openai/gpt-5.5',
                                    },
                                    models: {
                                        'openai/gpt-5.5': {
                                            agentRuntime: {
                                                id: 'codex',
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    }),
                },
            },
        ]);
    });
});

class FakeGateway implements OpenClawGatewayClient {
    readonly requests: Array<{ method: string; params: unknown }> = [];

    readonly #responses: Record<string, unknown>;

    constructor(responses: Record<string, unknown>) {
        this.#responses = responses;
    }

    close() {}

    async connect() {}

    onClose(_handler: () => void) {
        return () => {};
    }

    onEvent(_handler: OpenClawGatewayEventHandler) {
        return () => {};
    }

    async request<TPayload = unknown>(method: string, params?: unknown): Promise<TPayload> {
        this.requests.push({ method, params });
        const response = this.#responses[method];

        if (Array.isArray(response)) {
            const next = response.shift();
            return next as TPayload;
        }

        return response as TPayload;
    }
}
