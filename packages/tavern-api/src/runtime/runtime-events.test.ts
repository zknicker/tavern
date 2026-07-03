import assert from 'node:assert/strict';
import test from 'node:test';
import { agentRuntimeEventSchema } from './contracts.ts';

test('engine restart events parse through the runtime event union', () => {
    for (const phase of ['scheduled', 'restarting', 'completed']) {
        const event = agentRuntimeEventSchema.parse({
            phase,
            timestamp: '2026-06-11T12:00:00.000Z',
            type: 'engine.restart',
        });
        assert.equal(event.type, 'engine.restart');
    }
});

test('engine restart events reject unknown phases', () => {
    assert.throws(() =>
        agentRuntimeEventSchema.parse({
            phase: 'thinking-about-it',
            timestamp: '2026-06-11T12:00:00.000Z',
            type: 'engine.restart',
        })
    );
});

test('semanticMemory changed events carry coarse invalidation hints', () => {
    const event = agentRuntimeEventSchema.parse({
        paths: ['Projects/Alpha.md'],
        reason: 'watch',
        scope: 'content',
        timestamp: '2026-06-21T12:00:00.000Z',
        type: 'semanticMemory.changed',
    });

    assert.equal(event.type, 'semanticMemory.changed');
    assert.deepEqual(event.paths, ['Projects/Alpha.md']);
    assert.equal(event.scope, 'content');
});

test('rich response progress events carry renderable payloads', () => {
    const event = agentRuntimeEventSchema.parse({
        step: {
            detail: 'Quarterly Revenue',
            id: 'act_rich_response_1',
            kind: 'rich_response',
            label: 'Rich Response',
            richResponse: {
                component: 'tavern.rich_response',
                fallbackText: 'Quarterly Revenue',
                id: 'act_rich_response_1',
                props: {
                    spec: {
                        elements: {
                            chart: {
                                props: {
                                    data: [{ quarter: 'Q1', revenue: 12_000 }],
                                    series: [{ key: 'revenue', label: 'Revenue' }],
                                    title: 'Quarterly Revenue',
                                    xKey: 'quarter',
                                },
                                type: 'BarChart',
                            },
                        },
                        root: 'chart',
                        state: {},
                    },
                },
                target: 'chat.inline',
                validationError: null,
            },
            status: 'completed',
        },
        timestamp: '2026-06-11T12:00:00.000Z',
        turn: {
            agentId: 'main',
            chatId: 'cht_1',
            runId: 'run_1',
            sessionKey: 'session_1',
            startedAt: '2026-06-11T12:00:00.000Z',
        },
        type: 'turn.progress',
    });

    assert.equal(event.type, 'turn.progress');
    assert.equal(event.step.kind, 'rich_response');
    assert.equal(event.step.richResponse?.fallbackText, 'Quarterly Revenue');
});
