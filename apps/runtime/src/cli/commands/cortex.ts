import {
    agentRuntimeRoutes,
    cortexPageListSchema,
    cortexPageSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
    cortexTopicListSchema,
} from '@tavern/api';
import { getRuntimePort } from '../../config.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { errorBlock, writeJson } from '../ui.ts';
import {
    renderCortexPage,
    renderCortexPages,
    renderCortexSearch,
    renderCortexStatus,
    renderCortexTopics,
} from './cortex-render.ts';

/** Injectable I/O so tests run subcommands against fixtures, no real fetch. */
export interface CortexDeps {
    /** GET/POST a runtime route, returning parsed JSON or throwing on failure. */
    request(route: string | URL, init: RequestInit): Promise<unknown>;
    runtimeUrl: string;
    write(text: string): void;
}

/** Thrown when the runtime cannot be reached; rendered as the friendly hint. */
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

function defaultDeps(args: ParsedArgs): CortexDeps {
    const runtimeUrl = resolveRuntimeUrl(args);
    return {
        runtimeUrl,
        request: (route, init) => requestRuntimeJson(runtimeUrl, route, init),
        write: (text) => process.stdout.write(text),
    };
}

const json = (args: ParsedArgs) => Boolean(args.flags['--json']);

const statusSub: SubCommand = {
    name: 'status',
    summary: 'Show Cortex hub path, topic and page counts, and access',
    usage: 'tavern cortex status [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: [],
    examples: ['tavern cortex status', 'tavern cortex status --json'],
    run: (args) => runStatus(args),
};

const topicsSub: SubCommand = {
    name: 'topics',
    summary: 'List Cortex topics',
    usage: 'tavern cortex topics [--include-archived] [--json] [--runtime-url <url>]',
    flags: [archivedFlag(), ...jsonAndUrlFlags()],
    positionals: [],
    examples: ['tavern cortex topics', 'tavern cortex topics --include-archived'],
    run: (args) => runTopics(args),
};

const listSub: SubCommand = {
    name: 'list',
    summary: 'List Cortex pages, optionally within a topic',
    usage: 'tavern cortex list [--topic <topic>] [--include-archived] [--json] [--runtime-url <url>]',
    flags: [
        { name: '--topic', valueName: '<topic>', description: 'Limit to a topic' },
        archivedFlag(),
        ...jsonAndUrlFlags(),
    ],
    positionals: [],
    examples: ['tavern cortex list', 'tavern cortex list --topic runtime --json'],
    run: (args) => runList(args),
};

const getSub: SubCommand = {
    name: 'get',
    summary: 'Print one Cortex page',
    usage: 'tavern cortex get <topic> <path> [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: ['<topic>', '<path>'],
    examples: ['tavern cortex get runtime overview'],
    run: (args) => runGet(args),
};

const searchSub: SubCommand = {
    name: 'search',
    summary: 'Search Cortex pages',
    usage: 'tavern cortex search <query> [--topic <topic>] [--include-archived] [--json] [--runtime-url <url>]',
    flags: [
        { name: '--topic', valueName: '<topic>', description: 'Limit to a topic' },
        archivedFlag(),
        ...jsonAndUrlFlags(),
    ],
    positionals: ['<query>'],
    examples: ['tavern cortex search "wiki sync"', 'tavern cortex search deploy --topic runtime'],
    run: (args) => runSearch(args),
};

/** Every cortex subcommand, in display order. */
export const CORTEX_SUBCOMMANDS: SubCommand[] = [statusSub, topicsSub, listSub, getSub, searchSub];

async function runStatus(args: ParsedArgs, overrides?: Partial<CortexDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const status = cortexStatusSchema.parse(
            await deps.request(agentRuntimeRoutes.cortexStatus, { method: 'GET' })
        );
        return { value: status, human: () => renderCortexStatus(status) };
    });
}

async function runTopics(args: ParsedArgs, overrides?: Partial<CortexDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const url = new URL(agentRuntimeRoutes.cortexTopics, deps.runtimeUrl);
        if (args.flags['--include-archived']) {
            url.searchParams.set('includeArchived', 'true');
        }
        const topics = cortexTopicListSchema.parse(await deps.request(url, { method: 'GET' }));
        return { value: topics, human: () => renderCortexTopics(topics, process.stdout) };
    });
}

async function runList(args: ParsedArgs, overrides?: Partial<CortexDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const url = new URL(agentRuntimeRoutes.cortexPages, deps.runtimeUrl);
        const topic = args.values['--topic'];
        if (topic) {
            url.searchParams.set('topic', topic);
        }
        if (args.flags['--include-archived']) {
            url.searchParams.set('includeArchived', 'true');
        }
        const pages = cortexPageListSchema.parse(await deps.request(url, { method: 'GET' }));
        return { value: pages, human: () => renderCortexPages(pages, process.stdout) };
    });
}

async function runGet(args: ParsedArgs, overrides?: Partial<CortexDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [topic, pagePath] = args.positionals;
    return await emit(deps, args, async () => {
        const page = cortexPageSchema.parse(
            await deps.request(agentRuntimeRoutes.cortexPage(topic, pagePath), { method: 'GET' })
        );
        return { value: page, human: () => renderCortexPage(page, process.stdout) };
    });
}

async function runSearch(args: ParsedArgs, overrides?: Partial<CortexDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [query] = args.positionals;
    return await emit(deps, args, async () => {
        const result = cortexSearchResultSchema.parse(
            await deps.request(agentRuntimeRoutes.cortexSearch, {
                body: JSON.stringify({
                    includeArchived: Boolean(args.flags['--include-archived']),
                    query,
                    topic: args.values['--topic'] ?? null,
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        return { value: result, human: () => renderCortexSearch(result, process.stdout) };
    });
}

/**
 * Shared output path: run the fetch+parse, then emit `--json` through the shared
 * writer or the human render. Unreachable runtime → friendly error + hint (exit
 * 1); HTTP error payloads surface their message; never a raw fetch stack.
 */
async function emit(
    deps: CortexDeps,
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
                `${errorBlock(error.message, "Is the service running? Try 'tavern status'.")}\n`
            );
            return 1;
        }
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${errorBlock(message)}\n`);
        return 1;
    }
}

/** GET/POST a runtime route; throws RuntimeUnreachableError on transport failure. */
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
    return `Tavern Runtime request failed with HTTP ${status}.`;
}

function jsonAndUrlFlags() {
    return [
        { name: '--json', description: 'Emit one JSON document' },
        { name: '--runtime-url', valueName: '<url>', description: 'Override the Runtime API URL' },
    ];
}

function archivedFlag() {
    return { name: '--include-archived', description: 'Include archived topics and pages' };
}

// Test seams: invoke a subcommand with injected deps.
export const __test = { runStatus, runTopics, runList, runGet, runSearch };
