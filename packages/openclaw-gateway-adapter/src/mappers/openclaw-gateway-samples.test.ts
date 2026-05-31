import { describe, expect, it } from 'bun:test';
import { openClawGatewaySample } from '../test-data/openclaw-gateway-sample.ts';
import { mapOpenClawAgentFileContent, mapOpenClawAgentFileList } from './agents/files.ts';
import { mapOpenClawAgentList } from './agents/list.ts';
import { mapOpenClawChatsFromSessions } from './chats/list.ts';
import { mapOpenClawCronList } from './cron/list.ts';
import { mapOpenClawCronRuns } from './cron/runs.ts';
import { mapOpenClawModels } from './models/list.ts';
import { mapOpenClawSessionList } from './sessions/list.ts';
import { mapOpenClawSessionMessages } from './sessions/messages.ts';
import { mapOpenClawSkill } from './skills/get.ts';
import { mapOpenClawSkillList } from './skills/list.ts';

describe('OpenClaw Gateway sample mapping', () => {
    it('maps model inventory without volatile timestamps', () => {
        const models = mapOpenClawModels(openClawGatewaySample.models);

        expect(models.updatedAt).toBeNull();
        expect(models.models).toEqual([
            { id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'openai' },
            {
                id: 'anthropic/claude-4.5-sonnet',
                label: 'Claude Sonnet',
                provider: 'anthropic',
            },
        ]);
    });

    it('maps agents and agent files from real gateway shapes', () => {
        const agents = mapOpenClawAgentList(openClawGatewaySample.agents);
        const files = mapOpenClawAgentFileList(openClawGatewaySample.agentFilesList);
        const file = mapOpenClawAgentFileContent({
            content: openClawGatewaySample.agentFileGet,
            path: 'AGENTS.md',
        });

        expect(agents.agents.map((agent) => agent.id)).toEqual(['main', 'blippy']);
        expect(files.files[0]).toMatchObject({
            path: '/openclaw/workspace/theclaw/AGENTS.md',
            sizeBytes: 3089,
            updatedAt: '2026-05-03T12:06:40.000Z',
        });
        expect(file).toMatchObject({
            content: '# Agent Instructions\nUse gateway samples.\n',
            path: '/openclaw/workspace/theclaw/AGENTS.md',
            sizeBytes: 42,
            updatedAt: '2026-05-03T12:06:40.000Z',
        });
    });

    it('maps sessions into normalized chats with Discord-specific identity isolated', () => {
        const sessions = mapOpenClawSessionList(openClawGatewaySample.sessions);
        const chats = mapOpenClawChatsFromSessions(openClawGatewaySample.sessions);
        const channelChat = chats.chats.find(
            (chat) => chat.id === 'discord:channel:1090835947375054891'
        );
        const dmChat = chats.chats.find(
            (chat) => chat.id === 'discord:agent:blippy:dm:user:100000000000000001'
        );

        expect(sessions.sessions).toHaveLength(5);
        expect(
            sessions.sessions.find(
                (session) =>
                    session.key === 'agent:main:subagent:62d63671-c8d7-482b-a36f-1928780bfacf'
            )
        ).toMatchObject({
            agentId: 'main',
            chatId: 'discord:channel:1090835947375054891',
            platform: 'discord',
        });
        expect(channelChat).toMatchObject({
            bindings: [{ agentId: 'main' }, { agentId: 'tiny' }],
            participants: [
                { agentId: 'main', type: 'agent' },
                { agentId: 'tiny', type: 'agent' },
            ],
            platformMetadata: {
                accountIds: ['default', 'tiny'],
                channel: { id: '1090835947375054891', name: '#general' },
                dm: null,
                guild: { id: '1090835947375054888', name: null },
                observedLabels: [
                    '#general channel id:1090835947375054891',
                    'discord:1090835947375054888#general',
                ],
                provider: 'discord',
            },
            scope: 'channel',
            target: 'channel:1090835947375054891',
        });
        expect(
            channelChat?.platformMetadata?.sourceRecords.map((source) => source.sessionKey)
        ).toEqual([
            'agent:main:discord:channel:1090835947375054891',
            'agent:tiny:discord:channel:1090835947375054891',
        ]);
        expect(dmChat).toMatchObject({
            bindings: [{ agentId: 'blippy' }],
            participants: [
                { agentId: 'blippy', type: 'agent' },
                {
                    externalId: '100000000000000001',
                    name: 'example',
                    observedLabels: ['example', 'example user id:100000000000000001'],
                    participantId: 'participant:discord:global:external:100000000000000001',
                    platform: 'discord',
                    type: 'participant',
                },
            ],
            platformMetadata: {
                accountIds: ['blippy'],
                dm: { userId: '100000000000000001' },
                provider: 'discord',
            },
            scope: 'dm',
            target: 'dm:user:100000000000000001',
        });
    });

    it('maps messages with participants, attachments, and model metadata', () => {
        const dm = mapOpenClawSessionMessages({
            messages: openClawGatewaySample.chatHistory.dm,
            sessionKey: openClawGatewaySample.chatHistory.dm.sessionKey,
        });
        const channel = mapOpenClawSessionMessages({
            messages: openClawGatewaySample.chatHistory.channel,
            sessionKey: openClawGatewaySample.chatHistory.channel.sessionKey,
        });

        expect(dm.messages[0]).toMatchObject({
            id: 'client:user:0',
            participant: {
                externalId: '100000000000000001',
                name: 'Example User',
            },
            timestamp: '2026-05-02T20:45:27.254Z',
        });
        expect(dm.messages[1]?.metadata).toMatchObject({
            api: 'openai-responses',
            model: 'gpt-5.5',
            openClawApi: 'openai-responses',
            openClawModel: 'gpt-5.5',
            openClawProvider: 'openai',
            provider: 'codex',
            stopReason: 'stop',
        });
        expect(channel.messages[1]?.attachments).toEqual([
            {
                filename: 'chart.png',
                mediaType: 'image/png',
                path: '/openclaw/workspace/theclaw/chart.png',
                sizeBytes: 8000,
                type: 'file',
                uri: 'file:///openclaw/workspace/theclaw/chart.png',
            },
        ]);
    });

    it('maps cron jobs and runs without schedule or time fallbacks', () => {
        const jobs = mapOpenClawCronList(openClawGatewaySample.cron);
        const runs = mapOpenClawCronRuns(openClawGatewaySample.cronRuns);

        expect(jobs.jobs[0]).toMatchObject({
            agentId: 'tiny',
            id: 'd3292360-3ce0-4331-a917-e7eaba948886',
            schedule: { expr: '0 9 * * *', kind: 'cron', tz: 'America/New_York' },
            updatedAt: '2026-05-03T13:00:21.662Z',
        });
        expect(runs.runs[0]).toMatchObject({
            deliveryStatus: 'delivered',
            id: 'agent:tiny:cron:d3292360-3ce0-4331-a917-e7eaba948886:run:39e6406f-9730-43d5-8973-0f575f36dbc4',
            jobId: 'd3292360-3ce0-4331-a917-e7eaba948886',
            scheduledFor: '2026-05-03T13:00:00.013Z',
            sessionId: '39e6406f-9730-43d5-8973-0f575f36dbc4',
            status: 'success',
        });
    });

    it('maps skills from status and nested detail responses', () => {
        const skills = mapOpenClawSkillList(openClawGatewaySample.skills);
        const detail = mapOpenClawSkill(openClawGatewaySample.skillDetail, '1password');

        expect(skills.skills.map((skill) => skill.id)).toEqual(['1password', 'todo']);
        expect(detail).toMatchObject({
            contentMarkdown: '# 1Password\nUse the CLI.',
            files: [{ path: 'SKILL.md', sizeBytes: 1234 }],
            id: '1password',
            name: '1password',
            source: 'builtin',
            updatedAt: '2026-04-24T03:06:40.000Z',
        });
    });
});

describe('OpenClaw mapper contract hard failures', () => {
    it('rejects missing required stable ids', () => {
        expect(() => mapOpenClawAgentList({ agents: [{}] })).toThrow(/agent/i);
        expect(() => mapOpenClawSessionList({ sessions: [{}] })).toThrow(/session/i);
        expect(() =>
            mapOpenClawSessionMessages({
                messages: { messages: [{ content: 'No id', role: 'user', timestamp: 1 }] },
                sessionKey: 'agent:main:main',
            })
        ).toThrow(/stable id/i);
    });

    it('preserves missing skill timestamps as null', () => {
        const skills = mapOpenClawSkillList({ skills: [{ name: 'No timestamp' }] });
        const detail = mapOpenClawSkill({ name: 'No timestamp' }, 'no-timestamp');

        expect(skills.skills[0]?.updatedAt).toBeNull();
        expect(detail.updatedAt).toBeNull();
    });
});
