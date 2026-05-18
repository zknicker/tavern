import { describe, expect, it } from 'bun:test';
import { mapOpenClawChatStatuses } from './status.ts';

const chatId = 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:main:tavern:channel:${chatId}`;

describe('mapOpenClawChatStatuses', () => {
    it('projects active OpenClaw session runs into chat status', () => {
        const result = mapOpenClawChatStatuses({
            sessions: [
                {
                    agentId: 'main',
                    hasActiveRun: true,
                    key: sessionKey,
                    messageCount: 3,
                    runId: 'run-1',
                    sessionId: 'session-1',
                    startedAt: '2026-05-05T01:25:00.000Z',
                    updatedAt: 1_777_831_505_000,
                },
            ],
        });

        expect(result).toEqual({
            chats: [
                {
                    activeReply: {
                        agentId: 'main',
                        isThinking: true,
                        runId: 'run-1',
                        sessionKey,
                        startedAt: '2026-05-05T01:25:00.000Z',
                        text: '',
                    },
                    chatId,
                },
            ],
        });
    });

    it('uses a stable placeholder run id when sessions.list only exposes hasActiveRun', () => {
        const result = mapOpenClawChatStatuses({
            sessions: [
                {
                    agentId: 'main',
                    hasActiveRun: true,
                    key: sessionKey,
                    sessionId: 'session-1',
                    startedAt: '2026-05-05T01:25:00.000Z',
                },
            ],
        });

        expect(result.chats[0]?.activeReply.runId).toBe(
            `openclaw-active:${sessionKey}:2026-05-05T01:25:00.000Z`
        );
    });

    it('ignores inactive and timestamp-incomplete sessions', () => {
        const result = mapOpenClawChatStatuses({
            sessions: [
                {
                    agentId: 'main',
                    hasActiveRun: false,
                    key: sessionKey,
                    sessionId: 'session-1',
                    startedAt: 1_777_831_500_000,
                },
                {
                    agentId: 'main',
                    hasActiveRun: true,
                    key: `agent:main:tavern:channel:${chatId}`,
                    sessionId: 'session-2',
                },
            ],
        });

        expect(result).toEqual({ chats: [] });
    });
});
