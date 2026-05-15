import { describe, expect, it } from 'bun:test';
import {
    buildOpenRouterActivityOverview,
    createEmptyOpenRouterActivityOverview,
    normalizeOpenRouterActivityDate,
    toOpenRouterActivityRequestErrorMessage,
} from '../src/openrouter/activity.ts';
import {
    createEmptyClaudeUsageSnapshot,
    createEmptyCodexUsageSnapshot,
} from '../src/usage/live.ts';

describe('createEmptyClaudeUsageSnapshot', () => {
    it('returns the expected zeroed overview windows', () => {
        const snapshot = createEmptyClaudeUsageSnapshot(new Date('2026-03-16T15:34:00.000Z'));

        expect(snapshot.provider).toBe('claude');
        expect(snapshot.windows).toHaveLength(4);
        expect(snapshot.windows.map((window) => window.id)).toEqual([
            'current-session',
            'current-week-all-models',
            'current-week-sonnet',
            'current-week-opus',
        ]);
        expect(snapshot.windows.every((window) => window.usedPercent === 0)).toBe(true);
        expect(snapshot.windows.every((window) => window.remainingPercent === 100)).toBe(true);
    });
});

describe('createEmptyCodexUsageSnapshot', () => {
    it('returns the expected zeroed overview windows', () => {
        const snapshot = createEmptyCodexUsageSnapshot(new Date('2026-03-16T15:34:00.000Z'));

        expect(snapshot.provider).toBe('codex');
        expect(snapshot.windows).toHaveLength(2);
        expect(snapshot.windows.map((window) => window.id)).toEqual([
            'current-session',
            'current-week',
        ]);
        expect(snapshot.windows.every((window) => window.usedPercent === 0)).toBe(true);
        expect(snapshot.windows.every((window) => window.remainingPercent === 100)).toBe(true);
    });
});

describe('createEmptyOpenRouterActivityOverview', () => {
    it('builds 30 UTC day buckets including the current UTC day for an unconfigured key', () => {
        const overview = createEmptyOpenRouterActivityOverview(
            'unconfigured',
            'Missing key',
            new Date('2026-03-17T15:34:00.000Z')
        );

        expect(overview.status).toBe('unconfigured');
        expect(overview.days).toBe(30);
        expect(overview.series[0]?.date).toBe('2026-02-16');
        expect(overview.series[29]?.date).toBe('2026-03-17');
        expect(overview.message).toBe('Missing key');
    });
});

describe('buildOpenRouterActivityOverview', () => {
    it('aggregates daily usage by model permaslug', () => {
        const overview = buildOpenRouterActivityOverview(
            {
                data: [
                    {
                        byok_usage_inference: 0.5,
                        completion_tokens: 120,
                        date: '2026-03-17',
                        endpoint_id: 'endpoint-1',
                        model: 'openai/gpt-4.1',
                        model_permaslug: 'openai/gpt-4.1-2025-04-14',
                        prompt_tokens: 80,
                        provider_name: 'OpenAI',
                        reasoning_tokens: 10,
                        requests: 2,
                        usage: 1.25,
                    },
                    {
                        byok_usage_inference: 0,
                        completion_tokens: 30,
                        date: '2026-03-17',
                        endpoint_id: 'endpoint-2',
                        model: 'anthropic/claude-3.7-sonnet',
                        model_permaslug: 'anthropic/claude-3.7-sonnet',
                        prompt_tokens: 45,
                        provider_name: 'Anthropic',
                        reasoning_tokens: 0,
                        requests: 1,
                        usage: 0.75,
                    },
                    {
                        byok_usage_inference: 0.25,
                        completion_tokens: 20,
                        date: '2026-03-17',
                        endpoint_id: 'endpoint-1',
                        model: 'openai/gpt-4.1',
                        model_permaslug: 'openai/gpt-4.1-2025-04-14',
                        prompt_tokens: 20,
                        provider_name: 'OpenAI',
                        reasoning_tokens: 5,
                        requests: 3,
                        usage: 0.5,
                    },
                ],
            },
            new Date('2026-03-17T15:34:00.000Z')
        );

        expect(overview.status).toBe('ready');
        expect(overview.keys.map((key) => key.id)).toEqual([
            'openai/gpt-4.1-2025-04-14',
            'anthropic/claude-3.7-sonnet',
        ]);
        expect(overview.totalUsageUsd).toBe(2.5);
        expect(overview.totalByokUsageUsd).toBe(0.75);
        expect(overview.totalRequests).toBe(6);
        expect(overview.series[29]?.values).toEqual({
            'anthropic/claude-3.7-sonnet': 0.75,
            'openai/gpt-4.1-2025-04-14': 2.5,
        });
    });

    it('treats missing rows as an empty activity response', () => {
        const overview = buildOpenRouterActivityOverview(
            { data: [] },
            new Date('2026-03-17T15:34:00.000Z')
        );

        expect(overview.status).toBe('empty');
        expect(overview.note).toBeNull();
        expect(overview.series).toHaveLength(30);
    });

    it('includes the current UTC day as a zero bucket when OpenRouter has not reported it yet', () => {
        const overview = buildOpenRouterActivityOverview(
            {
                data: [
                    {
                        byok_usage_inference: 0,
                        completion_tokens: 30,
                        date: '2026-03-19',
                        endpoint_id: 'endpoint-1',
                        model: 'anthropic/claude-3.7-sonnet',
                        model_permaslug: 'anthropic/claude-3.7-sonnet',
                        prompt_tokens: 45,
                        provider_name: 'Anthropic',
                        reasoning_tokens: 0,
                        requests: 1,
                        usage: 0.75,
                    },
                ],
            },
            new Date('2026-03-20T18:28:23.788Z')
        );

        expect(overview.series[28]).toEqual({
            date: '2026-03-19',
            values: {
                'anthropic/claude-3.7-sonnet': 0.75,
            },
        });
        expect(overview.series[29]).toEqual({
            date: '2026-03-20',
            values: {
                'anthropic/claude-3.7-sonnet': 0,
            },
        });
    });
});

describe('toOpenRouterActivityRequestErrorMessage', () => {
    it('redacts invalid authorization header failures', () => {
        expect(
            toOpenRouterActivityRequestErrorMessage(
                new Error("Header '14' has invalid value: 'Bearer very-secret-value'")
            )
        ).toBe('OpenRouter management key looks invalid. Save a valid management key.');
    });
});

describe('normalizeOpenRouterActivityDate', () => {
    it('trims OpenRouter activity timestamps down to the UTC day', () => {
        expect(normalizeOpenRouterActivityDate('2026-03-15 00:00:00')).toBe('2026-03-15');
    });
});
