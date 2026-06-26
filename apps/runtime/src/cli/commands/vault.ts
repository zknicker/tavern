import {
    agentRuntimeRoutes,
    vaultPageListSchema,
    vaultPageSchema,
    vaultSearchResultSchema,
    vaultStatusSchema,
} from '@tavern/api';
import { getRuntimeApiToken, getRuntimePort } from '../../config.ts';
import type { ParsedArgs } from '../parse.ts';
import type { SubCommand } from '../subcommand.ts';
import { errorBlock, writeJson } from '../ui.ts';
import {
    renderVaultPage,
    renderVaultPages,
    renderVaultSearch,
    renderVaultStatus,
} from './vault-render.ts';

export interface VaultDeps {
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

function defaultDeps(args: ParsedArgs): VaultDeps {
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
    summary: 'Show Memory path, page count, taxonomy status, and access',
    usage: 'tavern vault status [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: [],
    examples: ['tavern vault status', 'tavern vault status --json'],
    run: (args) => runStatus(args),
};

const listSub: SubCommand = {
    name: 'list',
    summary: 'List Memory files',
    usage: 'tavern vault list [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: [],
    examples: ['tavern vault list'],
    run: (args) => runList(args),
};

const getSub: SubCommand = {
    name: 'get',
    summary: 'Print one Memory file',
    usage: 'tavern vault get <path> [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: ['<path>'],
    examples: ['tavern vault get MEMORY.md'],
    run: (args) => runGet(args),
};

const searchSub: SubCommand = {
    name: 'search',
    summary: 'Search Memory files',
    usage: 'tavern vault search <query> [--json] [--runtime-url <url>]',
    flags: jsonAndUrlFlags(),
    positionals: ['<query>'],
    examples: ['tavern vault search "ad campaigns"'],
    run: (args) => runSearch(args),
};

export const VAULT_SUBCOMMANDS: SubCommand[] = [statusSub, listSub, getSub, searchSub];

async function runStatus(args: ParsedArgs, overrides?: Partial<VaultDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const status = vaultStatusSchema.parse(
            await deps.request(agentRuntimeRoutes.vaultStatus, { method: 'GET' })
        );
        return { value: status, human: () => renderVaultStatus(status) };
    });
}

async function runList(args: ParsedArgs, overrides?: Partial<VaultDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    return await emit(deps, args, async () => {
        const pages = vaultPageListSchema.parse(
            await deps.request(agentRuntimeRoutes.vaultPages, { method: 'GET' })
        );
        return { value: pages, human: () => renderVaultPages(pages, process.stdout) };
    });
}

async function runGet(args: ParsedArgs, overrides?: Partial<VaultDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [pagePath] = args.positionals;
    return await emit(deps, args, async () => {
        const page = vaultPageSchema.parse(
            await deps.request(agentRuntimeRoutes.vaultPage(pagePath), { method: 'GET' })
        );
        return { value: page, human: () => renderVaultPage(page, process.stdout) };
    });
}

async function runSearch(args: ParsedArgs, overrides?: Partial<VaultDeps>): Promise<number> {
    const deps = { ...defaultDeps(args), ...overrides };
    const [query] = args.positionals;
    return await emit(deps, args, async () => {
        const result = vaultSearchResultSchema.parse(
            await deps.request(agentRuntimeRoutes.vaultSearch, {
                body: JSON.stringify({ query }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        return { value: result, human: () => renderVaultSearch(result, process.stdout) };
    });
}

async function emit(
    deps: VaultDeps,
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

export const __test = { runStatus, runList, runGet, runSearch };
