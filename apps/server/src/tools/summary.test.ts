import assert from 'node:assert/strict';
import test from 'node:test';
import { buildToolSummaryFromValues } from './summary.ts';

test('buildToolSummaryFromValues normalizes arguments and result into shared tool summary fields', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            path: 'README.md',
        },
        callId: 'call-1',
        isError: false,
        name: 'read',
        resultValue: {
            path: 'README.md',
            status: 'ok',
        },
    });

    assert.deepEqual(summary, {
        callId: 'call-1',
        facts: [
            {
                label: 'Path',
                tone: 'default',
                value: 'README.md',
            },
        ],
        label: 'read · README.md',
        model: undefined,
        name: 'read',
        status: 'ok',
        summaryParts: ['README.md'],
    });
});

test('buildToolSummaryFromValues marks error tool results consistently', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: null,
        callId: 'call-2',
        isError: true,
        name: 'exec',
        resultValue: {
            error: 'denied',
        },
    });

    assert.equal(summary.status, 'error');
    assert.deepEqual(summary.facts, [
        {
            label: 'Error',
            tone: 'danger',
            value: 'denied',
        },
    ]);
});
