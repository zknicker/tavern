import { vaultPageSchema, vaultSearchResultSchema, vaultStatusSchema } from '@tavern/api';
import { describe, expect, test, vi } from 'vitest';
import { __test, RuntimeUnreachableError, type VaultDeps } from './vault.ts';

const STATUS_FIXTURE = {
    configSource: 'default',
    indexExists: true,
    pageCount: 2,
    readable: true,
    vaultPath: '/tmp/wiki',
    writable: true,
};

const PAGE_FIXTURE = {
    body: '# Alpha\n\nBody.',
    frontmatter: {},
    links: [],
    path: 'Alpha.md',
    size: 14,
    title: 'Alpha',
    updatedAt: '2026-06-17T12:00:00.000Z',
    vaultPath: '/tmp/wiki',
};

const SEARCH_FIXTURE = {
    hits: [{ page: PAGE_FIXTURE, score: 6, snippet: 'Body.' }],
    limit: 20,
    offset: 0,
    query: 'alpha',
    totalHitCount: 1,
};

function args(input: { flags?: Record<string, boolean>; positionals?: string[] } = {}) {
    return {
        flags: input.flags ?? {},
        help: false,
        positionals: input.positionals ?? [],
        values: {},
    };
}

function harness(overrides: Partial<VaultDeps> = {}) {
    const captured: string[] = [];
    const deps: VaultDeps = {
        request: vi.fn(async () => STATUS_FIXTURE),
        runtimeUrl: 'http://127.0.0.1:18790',
        write: (text: string) => captured.push(text),
        ...overrides,
    };
    return { captured, deps };
}

function expectedJson(value: unknown) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

describe('vault status', () => {
    test('renders human status', async () => {
        const { captured, deps } = harness();

        await expect(__test.runStatus(args(), deps)).resolves.toBe(0);

        expect(captured.join('')).toContain('Vault');
        expect(captured.join('')).toContain('/tmp/wiki');
        expect(captured.join('')).toContain('INDEX.md');
    });

    test('--json emits parsed status', async () => {
        const { captured, deps } = harness();

        await expect(__test.runStatus(args({ flags: { '--json': true } }), deps)).resolves.toBe(0);

        expect(captured.join('')).toBe(expectedJson(vaultStatusSchema.parse(STATUS_FIXTURE)));
    });

    test('runtime unreachable renders friendly failure', async () => {
        const { deps } = harness({
            request: vi.fn(async () => {
                throw new RuntimeUnreachableError('http://127.0.0.1:18790');
            }),
        });
        const error = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        await expect(__test.runStatus(args(), deps)).resolves.toBe(1);

        expect(error.mock.calls.join('')).toContain('Runtime is not reachable');
    });
});

describe('vault list', () => {
    test('renders page list', async () => {
        const { captured, deps } = harness({
            request: vi.fn(async () => ({ pages: [PAGE_FIXTURE] })),
        });

        await expect(__test.runList(args(), deps)).resolves.toBe(0);

        expect(captured.join('')).toContain('Alpha.md');
    });
});

describe('vault get', () => {
    test('renders one page', async () => {
        const { captured, deps } = harness({
            request: vi.fn(async () => PAGE_FIXTURE),
        });

        await expect(__test.runGet(args({ positionals: ['Alpha.md'] }), deps)).resolves.toBe(0);

        expect(captured.join('')).toContain('# Alpha');
        expect(captured.join('')).toContain('Body.');
    });

    test('--json emits parsed page', async () => {
        const { captured, deps } = harness({
            request: vi.fn(async () => PAGE_FIXTURE),
        });

        await expect(
            __test.runGet(args({ flags: { '--json': true }, positionals: ['Alpha.md'] }), deps)
        ).resolves.toBe(0);

        expect(captured.join('')).toBe(expectedJson(vaultPageSchema.parse(PAGE_FIXTURE)));
    });
});

describe('vault search', () => {
    test('posts a query and renders hits', async () => {
        const request = vi.fn(async (_route: string | URL, init: RequestInit) => {
            expect(JSON.parse(String(init.body))).toEqual({ query: 'alpha' });
            return SEARCH_FIXTURE;
        });
        const { captured, deps } = harness({ request });

        await expect(__test.runSearch(args({ positionals: ['alpha'] }), deps)).resolves.toBe(0);

        expect(captured.join('')).toContain('Alpha.md');
    });

    test('--json emits parsed search result', async () => {
        const { captured, deps } = harness({
            request: vi.fn(async () => SEARCH_FIXTURE),
        });

        await expect(
            __test.runSearch(args({ flags: { '--json': true }, positionals: ['alpha'] }), deps)
        ).resolves.toBe(0);

        expect(captured.join('')).toBe(expectedJson(vaultSearchResultSchema.parse(SEARCH_FIXTURE)));
    });
});
