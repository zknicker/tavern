import {
    agentRuntimeRoutes,
    wikiPageListSchema,
    wikiPageSchema,
    wikiSearchResultSchema,
    wikiStatusSchema,
} from '@tavern/api';
import { getRuntimeApiToken, getRuntimePort } from '../../config.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { errorBlock, writeJson } from '../ui.ts';
import {
    renderWikiPage,
    renderWikiPages,
    renderWikiSearch,
    renderWikiStatus,
} from './wiki-render.ts';

export interface WikiDeps {
    request(route: string | URL, init: RequestInit): Promise<unknown>;
    runtimeUrl: string;
    write(text: string): void;
}

export class RuntimeUnreachableError extends Error {
    constructor(readonly url: string) {
        super(`Runtime is not reachable at ${url}`);
        this.name = 'RuntimeUnreachableError';
    }
}

function resolveRuntimeUrl(args: ParsedArgs): string {
    return (
        args.values['--runtime-url'] ??
        process.env.TAVERN_RUNTIME_URL ??
        `http://127.0.0.1:${getRuntimePort()}`
    );
}

function resolveAuthHeaders(): Record<string, string> {
    try {
        const token = getRuntimeApiToken();
        return token ? { authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

function defaultDeps(args: ParsedArgs): WikiDeps {
    const runtimeUrl = resolveRuntimeUrl(args);
    const authHeaders = resolveAuthHeaders();
    return {
        runtimeUrl,
        request: (route, init) =>
            requestRuntimeJson(runtimeUrl, route, {
                ...init,
                headers: {
                    ...authHeaders,
                    ...(init.headers as Record<string, string> | undefined),
                },
            }),
        write: (text) => process.stdout.write(text),
    };
}

const json = (args: ParsedArgs) => Boolean(args.flags['--json']);

const statusSub: SubCommand = {
    name: 'status',
    summary: 'Show Wiki path, page count, taxonomy status, and access',
    usage: 'grotto wiki status [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: [],
    examples: ['grotto wiki status', 'grotto wiki status --json'],
    run: (args) => runStatus(args),
};

const listSub: SubCommand = {
    name: 'list',
    summary: 'List Wiki pages',
    usage: 'grotto wiki list [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: [],
    examples: ['grotto wiki list'],
    run: (args) => runList(args),
};

const getSub: SubCommand = {
    name: 'get',
    summary: 'Print one Wiki page',
    usage: 'grotto wiki get <path> [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: ['<path>'],
    examples: ['grotto wiki get INDEX.md'],
    run: (args) => runGet(args),
};

const searchSub: SubCommand = {
    name: 'search',
    summary: 'Search Wiki pages',
    usage: 'grotto wiki search <query> [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: ['<query>'],
    examples: ['grotto wiki search "ad campaigns"'],
    run: (args) => runSearch(args),
};

export const WIKI_SUBCOMMANDS: SubCommand[] = [statusSub, listSub, getSub, searchSub];

async function runStatus(args: ParsedArgs, overrides?: Partial<WikiDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const status = wikiStatusSchema.parse(
            await deps.request(agentRuntimeRoutes.wikiStatus, { method: 'GET' })
        );
        return { value: status, human: () => renderWikiStatus(status) };
    });
}

async function runList(args: ParsedArgs, overrides?: Partial<WikiDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const pages = wikiPageListSchema.parse(
            await deps.request(agentRuntimeRoutes.wikiPages, { method: 'GET' })
        );
        return { value: pages, human: () => renderWikiPages(pages, process.stdout) };
    });
}

async function runGet(args: ParsedArgs, overrides?: Partial<WikiDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [pagePath] = args.positionals;
    return await emit(deps, args, async () => {
        const page = wikiPageSchema.parse(
            await deps.request(agentRuntimeRoutes.wikiPage(pagePath), { method: 'GET' })
        );
        return { value: page, human: () => renderWikiPage(page, process.stdout) };
    });
}

async function runSearch(args: ParsedArgs, overrides?: Partial<WikiDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [query] = args.positionals;
    return await emit(deps, args, async () => {
        const result = wikiSearchResultSchema.parse(
            await deps.request(agentRuntimeRoutes.wikiSearch, {
                body: JSON.stringify({ query }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        return { value: result, human: () => renderWikiSearch(result, process.stdout) };
    });
}

async function emit(
    deps: WikiDeps,
    args: ParsedArgs,
    work: () => Promise<{ human: () => string; value: unknown }>
): Promise<number> {
    try {
        const { value, human } = await work();
        if (json(args)) {
            writeJson(value, deps.write);
            return 0;
        }
        deps.write(`${human()}\n`);
        return 0;
    } catch (error) {
        if (error instanceof RuntimeUnreachableError) {
            process.stderr.write(
                `${errorBlock(error.message, "Is the service running? Try 'grotto status'.")}\n`
            );
            return 1;
        }
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${errorBlock(message)}\n`);
        return 1;
    }
}

async function requestRuntimeJson(
    runtimeUrl: string,
    route: string | URL,
    init: RequestInit
): Promise<unknown> {
    const url = route instanceof URL ? route : new URL(route, runtimeUrl);
    let response: Response;
    try {
        response = await fetch(url, init);
    } catch {
        throw new RuntimeUnreachableError(runtimeUrl);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(readRuntimeError(data, response.status));
    }
    return data;
}

function readRuntimeError(data: unknown, status: number): string {
    if (data && typeof data === 'object' && 'message' in data) {
        return String((data as { message: unknown }).message);
    }
    return `Grotto Runtime request failed with HTTP ${status}.`;
}

function jsonAndUrlFlags() {
    return [
        { name: '--json', description: 'Emit one JSON document' },
        { name: '--runtime-url', valueName: '<url>', description: 'Override the Runtime API URL' },
    ];
}

export const __test = { runStatus, runList, runGet, runSearch };
