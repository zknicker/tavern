import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileToolDrawerBody } from './file-tool-drawer-body.tsx';
import { GenericToolDrawerBody } from './generic-tool-drawer-body.tsx';
import { TerminalToolDrawerBody } from './terminal-tool-drawer-body.tsx';
import { ToolDrawerBody } from './tool-drawer-body.tsx';
import { buildToolDrawerCall, type ToolDrawerDetails } from './tool-drawer-call.ts';
import { resolveToolDrawerBody } from './tool-drawer-registry.tsx';

function buildDetails(overrides: Partial<ToolDrawerDetails>): ToolDrawerDetails {
    return {
        actions: [],
        arguments: null,
        completedAt: '2026-03-31T15:00:01.000Z',
        result: null,
        startedAt: '2026-03-31T15:00:00.000Z',
        toolCall: {
            callId: 'call-1',
            facts: [],
            label: null,
            name: 'tool',
            status: 'ok',
            summaryParts: [],
        },
        ...overrides,
    };
}

test('resolveToolDrawerBody matches exact names, substrings, then the generic fallback', () => {
    assert.equal(resolveToolDrawerBody('bash'), TerminalToolDrawerBody);
    assert.equal(resolveToolDrawerBody('computer-exec-runner'), TerminalToolDrawerBody);
    assert.equal(resolveToolDrawerBody('memory_search'), FileToolDrawerBody);
    assert.equal(resolveToolDrawerBody('weather'), GenericToolDrawerBody);
});

test('ToolDrawerBody renders terminal tools with command, output, and non-zero exit code', () => {
    const markup = renderToStaticMarkup(
        <ToolDrawerBody
            details={buildDetails({
                arguments: { command: 'bun test src', workdir: '/repo' },
                result: { error: 'tests failed', exitCode: 1, output: '2 pass\n1 fail' },
                toolCall: {
                    callId: 'call-shell',
                    facts: [],
                    label: 'bash · bun test src',
                    name: 'bash',
                    status: 'error',
                    summaryParts: ['bun test src'],
                },
            })}
            isPending={false}
            queryError={false}
        />
    );

    assert.match(markup, /\$ bun test src/);
    assert.match(markup, /\/repo/);
    assert.match(markup, /2 pass/);
    assert.match(markup, /exit 1/);
    assert.match(markup, /tests failed/);
    assert.doesNotMatch(markup, /&quot;command&quot;/);
});

test('ToolDrawerBody hides exit codes for successful terminal tools', () => {
    const markup = renderToStaticMarkup(
        <ToolDrawerBody
            details={buildDetails({
                arguments: { command: 'date' },
                result: { exitCode: 0, output: 'Wed Jun 10 00:24:28 EDT 2026' },
                toolCall: {
                    callId: 'call-date',
                    facts: [],
                    label: 'bash · date',
                    name: 'exec',
                    status: 'ok',
                    summaryParts: ['date'],
                },
            })}
            isPending={false}
            queryError={false}
        />
    );

    assert.match(markup, /\$ date/);
    assert.match(markup, /Wed Jun 10 00:24:28 EDT 2026/);
    assert.doesNotMatch(markup, /exit 0/);
});

test('ToolDrawerBody renders file tools with the resolved path and full content', () => {
    const markup = renderToStaticMarkup(
        <ToolDrawerBody
            details={buildDetails({
                arguments: { file_path: 'src/app.tsx' },
                result: { content: 'export const App = () => null;' },
                toolCall: {
                    callId: 'call-read',
                    facts: [],
                    label: 'read · src/app.tsx',
                    name: 'read',
                    status: 'ok',
                    summaryParts: ['src/app.tsx'],
                },
            })}
            isPending={false}
            queryError={false}
        />
    );

    assert.match(markup, /src\/app\.tsx/);
    assert.match(markup, /export const App = \(\) =&gt; null;/);
});

test('ToolDrawerBody renders generic tools as a key-value grid without JSON quoting', () => {
    const markup = renderToStaticMarkup(
        <ToolDrawerBody
            details={buildDetails({
                arguments: { channel: '#general', limit: 5 },
                result: 'delivered',
                toolCall: {
                    callId: 'call-notify',
                    facts: [],
                    label: 'notify',
                    name: 'notify',
                    status: 'ok',
                    summaryParts: ['#general'],
                },
            })}
            isPending={false}
            queryError={false}
        />
    );

    assert.match(markup, /channel/);
    assert.match(markup, /#general/);
    assert.doesNotMatch(markup, /&quot;#general&quot;/);
    assert.match(markup, /delivered/);
});

test('buildToolDrawerCall keeps full argument and result values', () => {
    const longOutput = 'line\n'.repeat(5000);
    const call = buildToolDrawerCall(
        buildDetails({
            arguments: JSON.stringify({ command: 'cat big-file' }),
            result: longOutput,
        })
    );

    assert.equal(call.arguments.command, 'cat big-file');
    assert.equal(call.result, longOutput);
    assert.equal(call.durationMs, 1000);
});
