import {
    cortexPageSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
    cortexTopicListSchema,
} from '@tavern/api';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ParsedArgs } from '../parse.ts';
import { __test, type CortexDeps, RuntimeUnreachableError } from './cortex.ts';

/** The --json contract is the serialization of the parsed schema object. */
function expectedJson(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

const ANSI = /\[/;

function args(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return { flags: {}, values: {}, positionals: [], help: false, ...over };
}

function harness(over: Partial<CortexDeps> = {}): {
    captured: string[];
    deps: Partial<CortexDeps>;
} {
    const captured: string[] = [];
    return {
        captured,
        deps: {
            runtimeUrl: 'http://runtime.test',
            request: () => Promise.resolve({}),
            write: (text) => captured.push(text),
            ...over,
        },
    };
}

const STATUS_FIXTURE = {
    archivedTopicCount: 1,
    configSource: 'runtime' as const,
    hubPath: '/Users/me/wiki',
    pageCount: 8,
    readable: true,
    topicCount: 2,
    writable: true,
};

const TOPICS_FIXTURE = {
    hubPath: '/Users/me/wiki',
    topics: [
        { archived: false, path: 'runtime', slug: 'runtime', title: 'Runtime' },
        { archived: true, path: 'old', slug: 'old', title: 'Old' },
    ],
};

const PAGE_FIXTURE = {
    archived: false,
    body: 'The body text.',
    frontmatter: {},
    links: [],
    path: 'overview',
    section: 'wiki' as const,
    size: 42,
    title: 'Overview',
    topic: 'runtime',
    updatedAt: '2026-06-10T11:00:00.000Z',
    wikiPath: '/Users/me/wiki/runtime/overview.md',
};

const SEARCH_FIXTURE = {
    hits: [
        {
            page: {
                archived: false,
                path: 'overview',
                section: 'wiki' as const,
                title: 'Overview',
                topic: 'runtime',
                updatedAt: '2026-06-10T11:00:00.000Z',
            },
            score: 0.8123,
            snippet: 'a wiki match',
        },
    ],
    limit: 20,
    offset: 0,
    query: 'wiki',
    totalHitCount: 1,
};

afterEach(() => vi.restoreAllMocks());

describe('cortex status', () => {
    test('prints aligned status from runtime, exit 0', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(STATUS_FIXTURE) });
        const code = await __test.runStatus(args(), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('Hub');
        expect(text).toContain('/Users/me/wiki');
        expect(text).toContain('Topics');
        expect(text).toContain('2 active, 1 archived');
        expect(ANSI.test(text)).toBe(false);
    });

    test('--json is byte-compatible with the parsed schema object', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(STATUS_FIXTURE) });
        await __test.runStatus(args({ flags: { '--json': true } }), deps);
        expect(captured.join('')).toBe(expectedJson(cortexStatusSchema.parse(STATUS_FIXTURE)));
    });

    test('unreachable runtime prints friendly error + hint, exit 1', async () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const { deps } = harness({
            request: () => Promise.reject(new RuntimeUnreachableError('http://runtime.test')),
        });
        const code = await __test.runStatus(args(), deps);
        const written = stderr.mock.calls.map((call) => call[0]).join('');
        expect(code).toBe(1);
        expect(written).toContain('Runtime is not reachable at http://runtime.test');
        expect(written).toContain("Is the service running? Try 'tavern status'.");
    });

    test('HTTP error payload surfaces its message, exit 1', async () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const { deps } = harness({
            request: () => Promise.reject(new Error('Cortex hub is not readable.')),
        });
        const code = await __test.runStatus(args(), deps);
        expect(code).toBe(1);
        expect(stderr.mock.calls.map((call) => call[0]).join('')).toContain(
            'Cortex hub is not readable.'
        );
    });
});

describe('cortex topics', () => {
    test('renders an aligned table including archived state', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(TOPICS_FIXTURE) });
        const code = await __test.runTopics(args(), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('runtime');
        expect(text).toContain('active');
        expect(text).toContain('archived');
        expect(text).not.toContain('\t');
    });

    test('--include-archived sets the query param', async () => {
        const seen: URL[] = [];
        const { deps } = harness({
            request: (route) => {
                seen.push(route as URL);
                return Promise.resolve(TOPICS_FIXTURE);
            },
        });
        await __test.runTopics(args({ flags: { '--include-archived': true } }), deps);
        expect(seen[0].searchParams.get('includeArchived')).toBe('true');
    });

    test('--json byte-compat', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(TOPICS_FIXTURE) });
        await __test.runTopics(args({ flags: { '--json': true } }), deps);
        expect(captured.join('')).toBe(expectedJson(cortexTopicListSchema.parse(TOPICS_FIXTURE)));
    });
});

describe('cortex list', () => {
    test('topic filter is sent as a query param', async () => {
        const seen: URL[] = [];
        const { deps } = harness({
            request: (route) => {
                seen.push(route as URL);
                return Promise.resolve({ pages: [], topic: 'runtime' });
            },
        });
        await __test.runList(args({ values: { '--topic': 'runtime' } }), deps);
        expect(seen[0].searchParams.get('topic')).toBe('runtime');
    });

    test('empty pages renders a dim placeholder, exit 0', async () => {
        const { captured, deps } = harness({
            request: () => Promise.resolve({ pages: [], topic: null }),
        });
        const code = await __test.runList(args(), deps);
        expect(code).toBe(0);
        expect(captured.join('')).toContain('No pages.');
    });
});

describe('cortex get', () => {
    test('renders title, meta, and body', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(PAGE_FIXTURE) });
        const code = await __test.runGet(args({ positionals: ['runtime', 'overview'] }), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(text).toContain('# Overview');
        expect(text).toContain('topic');
        expect(text).toContain('The body text.');
    });

    test('--json byte-compat', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(PAGE_FIXTURE) });
        await __test.runGet(
            args({ positionals: ['runtime', 'overview'], flags: { '--json': true } }),
            deps
        );
        expect(captured.join('')).toBe(expectedJson(cortexPageSchema.parse(PAGE_FIXTURE)));
    });
});

describe('cortex search', () => {
    test('posts the query and renders hits', async () => {
        const bodies: string[] = [];
        const { captured, deps } = harness({
            request: (_route, init) => {
                bodies.push(String(init.body));
                return Promise.resolve(SEARCH_FIXTURE);
            },
        });
        const code = await __test.runSearch(args({ positionals: ['wiki'] }), deps);
        const text = captured.join('');
        expect(code).toBe(0);
        expect(JSON.parse(bodies[0]).query).toBe('wiki');
        expect(text).toContain('Overview');
        expect(text).toContain('0.81');
    });

    test('--json byte-compat', async () => {
        const { captured, deps } = harness({ request: () => Promise.resolve(SEARCH_FIXTURE) });
        await __test.runSearch(args({ positionals: ['wiki'], flags: { '--json': true } }), deps);
        expect(captured.join('')).toBe(
            expectedJson(cortexSearchResultSchema.parse(SEARCH_FIXTURE))
        );
    });
});
