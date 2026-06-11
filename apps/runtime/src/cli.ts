import {
    agentRuntimeRoutes,
    cortexPageListSchema,
    cortexPageSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
    cortexTopicListSchema,
} from '@tavern/api';
import { getRuntimePort } from './config';

interface CortexCliOptions {
    json: boolean;
    runtimeUrl: string;
}

export async function runCortexCli(args: string[]): Promise<void> {
    const options = readCortexCliOptions(args);
    const commandIndex = findCommandIndex(args);
    const command = commandIndex === -1 ? null : args[commandIndex];
    const rest = commandIndex === -1 ? [] : args.slice(commandIndex + 1);

    switch (command) {
        case 'get':
            await getCortexPageCli(rest, options);
            return;
        case 'list':
            await listCortexPagesCli(rest, options);
            return;
        case 'search':
            await searchCortex(rest, options);
            return;
        case 'status':
            await showCortexStatus(options);
            return;
        case 'topics':
            await listCortexTopicsCli(rest, options);
            return;
        default:
            throw new Error(
                command ? `Unknown cortex command: ${command}` : 'Missing cortex command.'
            );
    }
}

function readCortexCliOptions(args: string[]): CortexCliOptions {
    return {
        json: args.includes('--json'),
        runtimeUrl:
            readOption(args, '--runtime-url') ??
            process.env.TAVERN_RUNTIME_URL ??
            `http://127.0.0.1:${getRuntimePort()}`,
    };
}

async function showCortexStatus(options: CortexCliOptions): Promise<void> {
    const status = cortexStatusSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexStatus, { method: 'GET' })
    );
    if (options.json) {
        printJson(status);
        return;
    }
    console.log(`Hub: ${status.hubPath}`);
    console.log(`Topics: ${status.topicCount} active, ${status.archivedTopicCount} archived`);
    console.log(`Pages: ${status.pageCount}`);
    console.log(`Access: readable=${status.readable} writable=${status.writable}`);
}

async function listCortexTopicsCli(args: string[], options: CortexCliOptions): Promise<void> {
    const url = new URL(agentRuntimeRoutes.cortexTopics, options.runtimeUrl);
    if (args.includes('--include-archived')) {
        url.searchParams.set('includeArchived', 'true');
    }
    const topics = cortexTopicListSchema.parse(await runtimeJson(options, url, { method: 'GET' }));
    if (options.json) {
        printJson(topics);
        return;
    }
    for (const topic of topics.topics) {
        console.log(`${topic.slug}\t${topic.archived ? 'archived' : 'active'}\t${topic.path}`);
    }
}

async function listCortexPagesCli(args: string[], options: CortexCliOptions): Promise<void> {
    const url = new URL(agentRuntimeRoutes.cortexPages, options.runtimeUrl);
    const topic = readOption(args, '--topic');
    if (topic) {
        url.searchParams.set('topic', topic);
    }
    if (args.includes('--include-archived')) {
        url.searchParams.set('includeArchived', 'true');
    }
    const pages = cortexPageListSchema.parse(await runtimeJson(options, url, { method: 'GET' }));
    if (options.json) {
        printJson(pages);
        return;
    }
    for (const page of pages.pages) {
        console.log(`${page.topic}\t${page.section}\t${page.path}\t${page.title}`);
    }
}

async function getCortexPageCli(args: string[], options: CortexCliOptions): Promise<void> {
    const [topic, pagePath] = readPositionals(args, 2);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(topic, pagePath), {
            method: 'GET',
        })
    );
    if (options.json) {
        printJson(page);
        return;
    }
    console.log(`# ${page.title}`);
    console.log('');
    console.log(`topic: ${page.topic}`);
    console.log(`path: ${page.path}`);
    console.log('');
    console.log(page.body);
}

async function searchCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const query = readPositional(args);
    const result = cortexSearchResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexSearch, {
            body: JSON.stringify({
                includeArchived: args.includes('--include-archived'),
                query,
                topic: readOption(args, '--topic'),
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        })
    );
    if (options.json) {
        printJson(result);
        return;
    }
    for (const hit of result.hits) {
        console.log(`${hit.page.topic}\t${hit.page.path}\t${hit.score}\t${hit.page.title}`);
    }
}

async function runtimeJson(
    options: CortexCliOptions,
    route: string | URL,
    init: RequestInit
): Promise<unknown> {
    const url = route instanceof URL ? route : new URL(route, options.runtimeUrl);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(readRuntimeError(data, response.status));
    }
    return data;
}

function findCommandIndex(args: string[]) {
    return args.findIndex(
        (arg, index) =>
            !arg.startsWith('--') && (index === 0 || args[index - 1]?.startsWith('--') !== true)
    );
}

function readOption(args: string[], flag: string): string | null {
    const index = args.indexOf(flag);
    if (index === -1) {
        return null;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a value.`);
    }
    return value;
}

function readPositional(args: string[]): string {
    const value = readPositionals(args, 1)[0];
    if (!value) {
        throw new Error('Missing required text argument.');
    }
    return value;
}

function readPositionals(args: string[], count: number): string[] {
    const values = args.filter((arg, index) => {
        if (arg.startsWith('--')) {
            return false;
        }
        return index === 0 || !args[index - 1]?.startsWith('--');
    });
    if (values.length < count) {
        throw new Error(`Expected ${count} positional argument(s).`);
    }
    return values.slice(0, count);
}

function readRuntimeError(data: unknown, status: number): string {
    if (data && typeof data === 'object' && 'message' in data) {
        return String(data.message);
    }
    return `Tavern Runtime request failed with HTTP ${status}.`;
}

function printJson(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}
