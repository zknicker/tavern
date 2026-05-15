import { describe, expect, it } from 'bun:test';
import {
    parseClaudeUsageSnapshot,
    parseCodexUsageSnapshot,
    parseOpenRouterUsageOverview,
    UsageParseError,
} from '../src/storage/provider-usage.ts';

describe('parseClaudeUsageSnapshot', () => {
    it('accepts a stored Claude snapshot', () => {
        const snapshot = parseClaudeUsageSnapshot(
            JSON.stringify({
                capturedAt: '2026-03-18T19:00:00.000Z',
                extraUsage: null,
                provider: 'claude',
                source: 'anthropic-oauth-usage',
                subscriptionType: 'claude_max',
                windows: [
                    {
                        id: 'current-session',
                        label: 'Current session',
                        remainingPercent: 80,
                        resetsAt: null,
                        usedPercent: 20,
                    },
                ],
            })
        );

        expect(snapshot.provider).toBe('claude');
        expect(snapshot.windows[0]?.id).toBe('current-session');
    });
});

describe('parseCodexUsageSnapshot', () => {
    it('rejects invalid stored Codex usage', () => {
        expect(() =>
            parseCodexUsageSnapshot(
                JSON.stringify({
                    capturedAt: '2026-03-18T19:00:00.000Z',
                    creditsBalance: null,
                    planType: null,
                    provider: 'codex',
                    source: 'chatgpt-wham-usage',
                    windows: [
                        {
                            id: 'unknown-window',
                            label: 'Broken',
                            remainingPercent: 80,
                            resetAfterSeconds: null,
                            resetsAt: null,
                            usedPercent: 20,
                        },
                    ],
                })
            )
        ).toThrow(UsageParseError);
    });
});

describe('parseOpenRouterUsageOverview', () => {
    it('accepts a stored OpenRouter overview', () => {
        const overview = parseOpenRouterUsageOverview(
            JSON.stringify({
                days: 30,
                keys: [
                    {
                        id: 'openai/gpt-4.1',
                        label: 'openai/gpt-4.1',
                        providerName: 'OpenAI',
                    },
                ],
                message: null,
                note: 'Daily account activity includes OpenRouter credit spend and BYOK inference spend.',
                series: [
                    {
                        date: '2026-03-17',
                        values: {
                            'openai/gpt-4.1': 12.5,
                        },
                    },
                ],
                status: 'ready',
                totalByokUsageUsd: 2.5,
                totalRequests: 42,
                totalUsageUsd: 10,
            })
        );

        expect(overview.status).toBe('ready');
        expect(overview.keys[0]?.providerName).toBe('OpenAI');
    });
});
