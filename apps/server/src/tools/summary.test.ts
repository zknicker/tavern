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

test('buildToolSummaryFromValues keeps shell output out of summaryParts', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            command: 'sleep 4 && echo done',
        },
        callId: 'call-shell',
        isError: false,
        name: 'bash',
        resultValue: {
            output: 'done',
            text: 'done',
        },
    });

    assert.deepEqual(summary.summaryParts, ['sleep 4 && echo done']);
});

test('buildToolSummaryFromValues keeps multi-line shell output out of summaryParts', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            command: 'date && whoami && ls | head -3',
        },
        callId: 'call-shell-2',
        isError: false,
        name: 'exec',
        resultValue: {
            text: 'Wed Jun 10 00:24:28 EDT 2026\nzknicker\nREADME.md',
        },
    });

    assert.deepEqual(summary.summaryParts, ['date && whoami && ls | head -3']);
    assert.equal(
        summary.summaryParts.some((part) => part.includes('Wed Jun 10')),
        false
    );
});

test('buildToolSummaryFromValues summarizes terminal cmd arguments as commands', () => {
    const command = 'merchbase sales series --range 10d --bucket day --marketplace US';
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            cmd: command,
        },
        callId: 'call-terminal',
        isError: false,
        name: 'terminal',
        resultValue: {
            output: '{"ok":true}',
        },
    });

    assert.deepEqual(summary.summaryParts, [command]);
    assert.deepEqual(summary.facts[0], {
        label: 'Command',
        tone: 'default',
        value: command,
    });
    assert.equal(
        summary.summaryParts.some((part) => part.includes('ok')),
        false
    );
});

test('buildToolSummaryFromValues summarizes command tools by command instead of description', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            command: "curl -L --silent 'https://duckduckgo.com/html/?q=site%3Anasa.gov'",
            description: 'Security scan — [HIGH] Invalid characters in hostname.',
        },
        callId: 'call-command',
        isError: false,
        name: 'terminal',
        resultValue: null,
    });

    assert.deepEqual(summary.summaryParts, [
        "curl -L --silent 'https://duckduckgo.com/html/?q=site%3Anasa.gov'",
    ]);
});

test('buildToolSummaryFromValues summarizes search tools as pattern in path', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            path: 'src/tools',
            pattern: 'TODO',
        },
        callId: 'call-grep',
        isError: false,
        name: 'grep',
        resultValue: {
            message: 'src/tools/summary.ts:12 TODO tidy',
        },
    });

    assert.deepEqual(summary.summaryParts, ['TODO in src/tools']);
});

test('buildToolSummaryFromValues summarizes search tools with only a pattern', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            pattern: '*.test.ts',
        },
        callId: 'call-search',
        isError: false,
        name: 'search',
        resultValue: {
            output: 'summary.test.ts\nlabel.test.ts',
        },
    });

    assert.deepEqual(summary.summaryParts, ['*.test.ts']);
});

test('buildToolSummaryFromValues keeps result text out of generic tool summaryParts', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            target: '#general',
        },
        callId: 'call-message',
        isError: false,
        name: 'notify',
        resultValue: {
            message: 'delivered to 4 members',
            output: 'ok',
        },
    });

    assert.deepEqual(summary.summaryParts, ['#general']);
    assert.equal(
        summary.summaryParts.some((part) => part.includes('delivered') || part.includes('ok')),
        false
    );
});

test('buildToolSummaryFromValues marks timed out tool results consistently', () => {
    const summary = buildToolSummaryFromValues({
        argumentsValue: {
            command: 'sleep 5',
        },
        callId: 'call-timeout',
        isError: false,
        name: 'bash',
        resultValue: {
            failureKind: 'overall-timeout',
            reason: 'command timed out',
            timedOut: true,
        },
    });

    assert.equal(summary.status, 'timeout');
    assert.equal(
        summary.facts.some((fact) => fact.label === 'Reason'),
        true
    );
});
