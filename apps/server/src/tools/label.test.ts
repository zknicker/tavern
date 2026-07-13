import assert from 'node:assert/strict';
import test from 'node:test';
import { buildToolLabel } from './label.ts';

function getLabel(
    input: Partial<Parameters<typeof buildToolLabel>[0]> &
        Pick<Parameters<typeof buildToolLabel>[0], 'name'>
) {
    return buildToolLabel({
        argumentsValue: input.argumentsValue ?? null,
        facts: input.facts ?? [],
        name: input.name,
        resultValue: input.resultValue ?? null,
        status: input.status ?? null,
    });
}

test('buildToolLabel prefers sessions_spawn errors', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                mode: 'run',
                runtime: 'subagent',
            },
            name: 'sessions_spawn',
            resultValue: {
                error: 'streamTo is only supported for runtime=acp; got runtime=subagent',
                status: 'error',
            },
            status: 'error',
        }),
        'streamTo is only supported for runtime=acp; got runtime=subagent'
    );
});

test('buildToolLabel summarizes spawned ACP sessions', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                agentId: 'codex',
                mode: 'run',
                runtime: 'acp',
            },
            name: 'sessions_spawn',
            resultValue: {
                childSessionKey: 'agent:codex:acp:child-1',
                mode: 'run',
                status: 'accepted',
            },
        }),
        'run codex ACP'
    );
});

test('buildToolLabel summarizes subagent list results', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                action: 'list',
            },
            name: 'subagents',
            resultValue: {
                active: [
                    {
                        label: 'daily checkin',
                        sessionKey: 'agent:tiny:subagent:child-1',
                    },
                ],
            },
        }),
        'list · 1 active'
    );
});

test('buildToolLabel summarizes subagent targets', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                action: 'steer',
                target: 'agent:tiny:subagent:child-1',
            },
            name: 'subagents',
            resultValue: {
                sessionKey: 'agent:tiny:subagent:child-1',
                status: 'done',
            },
        }),
        'steer · tiny · subagent'
    );
});

test('buildToolLabel summarizes session history targets and counts', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                sessionKey: 'agent:tiny:subagent:child-1',
            },
            name: 'sessions_history',
            resultValue: {
                messages: [{ id: '1' }, { id: '2' }],
            },
        }),
        'history · tiny · subagent · 2 messages'
    );
});

test('buildToolLabel prefers message errors over summary text', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                action: 'read',
                channel: '1090835947375054891',
            },
            name: 'message',
            resultValue: {
                error: 'Action read requires a target.',
                status: 'error',
            },
            status: 'error',
        }),
        'Action read requires a target.'
    );
});

test('buildToolLabel summarizes session lists', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                kinds: ['acp'],
            },
            name: 'sessions_list',
            resultValue: {
                count: 2,
            },
        }),
        'list · ACP · 2 sessions'
    );
});

test('buildToolLabel summarizes cron list responses', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                action: 'list',
            },
            name: 'cron',
            resultValue: {
                text: JSON.stringify({
                    jobs: [{ id: 'job-1' }, { id: 'job-2' }],
                }),
            },
        }),
        'list · 2 jobs'
    );
});

test('buildToolLabel summarizes session_status output', () => {
    assert.equal(
        getLabel({
            argumentsValue: {},
            name: 'session_status',
            resultValue: {
                text: '🧵 Session: agent:flicker:discord:channel:1471265219014561953 • updated just now',
            },
        }),
        'current · flicker · discord'
    );
});

test('buildToolLabel summarizes wiki search queries and counts', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                query: 'Etsy due date overdue shipping orders business rules',
            },
            name: 'wiki_search',
            resultValue: {
                hits: [{ path: 'memory/2026-02-16.md' }],
            },
        }),
        'search · Etsy due date overdue shipping… · 1 result'
    );
});

test('buildToolLabel summarizes read tool paths relative to workspace', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                file_path: '/Users/zknicker/.tavern/workspace/flicker/AGENTS.md',
            },
            name: 'read',
        }),
        'read · AGENTS.md'
    );
});

test('buildToolLabel summarizes web search queries across provider names', () => {
    for (const name of ['web_search', 'webSearch', 'WebSearch']) {
        assert.equal(
            getLabel({
                argumentsValue: {
                    query: 'best espresso machines 2026',
                },
                name,
            }),
            'search · best espresso machines 2026'
        );
    }
});

test('buildToolLabel marks unavailable web search', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                query: 'weather',
            },
            name: 'web_search',
            status: 'error',
        }),
        'search · weather · unavailable'
    );
});

test('buildToolLabel summarizes web fetch by host', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                url: 'https://example.com/docs/page?ref=1',
            },
            name: 'web_fetch',
        }),
        'fetch · example.com'
    );
});

test('buildToolLabel falls back to fetch without a url', () => {
    assert.equal(
        getLabel({
            argumentsValue: {},
            name: 'web_fetch',
        }),
        'fetch'
    );
});

test('buildToolLabel preserves browser error detail', () => {
    assert.equal(
        getLabel({
            argumentsValue: {
                action: 'navigate',
                url: 'https://www.etsy.com',
            },
            name: 'browser',
            resultValue: {
                error: "Playwright is not available in this gateway build; 'navigate' is unsupported.",
            },
            status: 'error',
        }),
        "Playwright is not available in this gateway build; 'navigate' is unsupported."
    );
});
