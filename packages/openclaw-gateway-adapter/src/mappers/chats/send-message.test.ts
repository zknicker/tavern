import { describe, expect, it } from 'bun:test';
import type { AgentRuntimeCreateMessage } from '@tavern/api';
import {
    mapOpenClawMessageAccepted,
    mapTavernMessageToOpenClawChatSend,
    mapTavernMessageToOpenClawTavernTurn,
} from './send-message.ts';

describe('OpenClaw send-message mapping', () => {
    it('uses the synced session key when Tavern has one for the chat and agent', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3', {
                agent: { agentId: 'blippy' },
                message: { content: 'hello', id: 'msg_1' },
                target: {
                    externalId: 'cht_1',
                    sessionKey:
                        'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    target: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    type: 'tavern',
                },
            })
        ).toEqual({
            agent: { agentId: 'blippy' },
            chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            message: {
                content: 'hello',
                id: 'msg_1',
            },
            sender: {
                id: 'tavern-user',
                name: 'Tavern',
            },
            sessionKey: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            turnId: 'run_1',
        });
    });

    it('does not guess a session key without a synced binding', () => {
        expect(() =>
            mapTavernMessageToOpenClawTavernTurn('cht_1', {
                agent: { agentId: 'main' },
                message: { content: 'hello', id: 'msg_2' },
                target: {
                    externalId: 'cht_1',
                    sessionKey: null,
                    target: 'chat:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    type: 'tavern',
                },
            })
        ).toThrow(/session key/i);
    });

    it('passes every Tavern-owned mention kind through to Tavern Messenger', () => {
        const input: AgentRuntimeCreateMessage = {
            agent: { agentId: 'blippy' },
            message: {
                content:
                    'Use [$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md), [@Computer Use](plugin://computer-use@openai-bundled), [@Chrome](plugin://computer-use@openai-bundled), [mentions.md](/repo/specs/mentions.md), and [components/ui](/repo/apps/website/src/components/ui).',
                id: 'msg_1',
                metadata: {
                    tavern: {
                        mentions: [
                            {
                                end: 75,
                                id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                                kind: 'skill',
                                label: 'Agent Browser',
                                projection: 'skill-context',
                                start: 4,
                                text: '[$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
                            },
                            {
                                end: 133,
                                id: 'plugin://computer-use@openai-bundled',
                                kind: 'plugin',
                                label: 'Computer Use',
                                projection: 'capability-reference',
                                start: 77,
                                text: '[@Computer Use](plugin://computer-use@openai-bundled)',
                            },
                            {
                                end: 182,
                                id: 'plugin://computer-use@openai-bundled',
                                kind: 'app',
                                label: 'Chrome',
                                metadata: { bundleId: 'com.google.Chrome' },
                                projection: 'capability-reference',
                                start: 135,
                                text: '[@Chrome](plugin://computer-use@openai-bundled)',
                            },
                            {
                                end: 217,
                                id: '/repo/specs/mentions.md',
                                kind: 'file',
                                label: 'mentions.md',
                                projection: 'path-reference',
                                start: 179,
                                text: '[mentions.md](/repo/specs/mentions.md)',
                            },
                            {
                                end: 278,
                                id: '/repo/apps/website/src/components/ui',
                                kind: 'directory',
                                label: 'components/ui',
                                projection: 'path-reference',
                                start: 223,
                                text: '[components/ui](/repo/apps/website/src/components/ui)',
                            },
                        ],
                    },
                },
            },
            target: {
                externalId: 'cht_1',
                sessionKey: 'agent:blippy:tavern:channel:cht_1',
                target: 'chat:cht_1',
                type: 'tavern',
            },
        };

        expect(mapTavernMessageToOpenClawTavernTurn('cht_1', input).message.metadata).toEqual({
            tavern: {
                mentions: [
                    {
                        end: 75,
                        id: '/Users/zknicker/.agents/skills/agent-browser/SKILL.md',
                        kind: 'skill',
                        label: 'Agent Browser',
                        projection: 'skill-context',
                        start: 4,
                        text: '[$agent-browser](/Users/zknicker/.agents/skills/agent-browser/SKILL.md)',
                    },
                    {
                        end: 133,
                        id: 'plugin://computer-use@openai-bundled',
                        kind: 'plugin',
                        label: 'Computer Use',
                        projection: 'capability-reference',
                        start: 77,
                        text: '[@Computer Use](plugin://computer-use@openai-bundled)',
                    },
                    {
                        end: 182,
                        id: 'plugin://computer-use@openai-bundled',
                        kind: 'app',
                        label: 'Chrome',
                        metadata: { bundleId: 'com.google.Chrome' },
                        projection: 'capability-reference',
                        start: 135,
                        text: '[@Chrome](plugin://computer-use@openai-bundled)',
                    },
                    {
                        end: 217,
                        id: '/repo/specs/mentions.md',
                        kind: 'file',
                        label: 'mentions.md',
                        projection: 'path-reference',
                        start: 179,
                        text: '[mentions.md](/repo/specs/mentions.md)',
                    },
                    {
                        end: 278,
                        id: '/repo/apps/website/src/components/ui',
                        kind: 'directory',
                        label: 'components/ui',
                        projection: 'path-reference',
                        start: 223,
                        text: '[components/ui](/repo/apps/website/src/components/ui)',
                    },
                ],
            },
        });
    });

    it('maps plain text sends through Tavern Messenger turn intake', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('cht_1', {
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
            })
        ).toMatchObject({
            chatId: 'cht_1',
            message: {
                content: 'hello',
                id: 'msg_1',
            },
            sessionKey: 'agent:blippy:tavern:channel:cht_1',
            turnId: 'run_1',
        });
    });

    it('maps Tavern chat sends to native OpenClaw chat.send params', () => {
        expect(
            mapTavernMessageToOpenClawChatSend({
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
            })
        ).toEqual({
            deliver: false,
            idempotencyKey: 'run_1',
            message: 'hello',
            sessionKey: 'agent:blippy:tavern:channel:cht_1',
        });
    });

    it('maps message acceptance with the requested session key', () => {
        expect(
            mapOpenClawMessageAccepted(
                {
                    runId: 'run_1',
                    status: 'started',
                },
                'agent:blippy:tavern:channel:cht_1'
            )
        ).toMatchObject({
            runId: 'run_1',
            sessionKey: 'agent:blippy:tavern:channel:cht_1',
            status: 'accepted',
        });
    });

    it('strips non-Tavern runtime metadata from Tavern sends', () => {
        expect(
            mapTavernMessageToOpenClawTavernTurn('cht_1', {
                agent: { agentId: 'blippy' },
                message: {
                    content: 'use Chrome',
                    id: 'msg_1',
                    metadata: {
                        tavern: {
                            mentions: [
                                {
                                    end: 10,
                                    id: 'chrome',
                                    kind: 'skill',
                                    label: 'Chrome',
                                    projection: 'skill-context',
                                    start: 4,
                                    text: 'Chrome',
                                },
                            ],
                        },
                        model: 'gpt-5.5',
                        provider: 'openrouter',
                        stopReason: 'error',
                        toolCallId: 'tool-call-1',
                    },
                },
                target: {
                    externalId: 'cht_1',
                    sessionKey: 'agent:blippy:tavern:channel:cht_1',
                    target: 'chat:cht_1',
                    type: 'tavern',
                },
            }).message.metadata
        ).toEqual({
            tavern: {
                mentions: [
                    {
                        end: 10,
                        id: 'chrome',
                        kind: 'skill',
                        label: 'Chrome',
                        projection: 'skill-context',
                        start: 4,
                        text: 'Chrome',
                    },
                ],
            },
        });
    });

    it('requires a stable OpenClaw run id from message acceptance', () => {
        expect(() => mapOpenClawMessageAccepted({ sessionKey: 'agent:main:main' })).toThrow(
            /runId/i
        );
    });
});
