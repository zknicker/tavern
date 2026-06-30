import type { McpServerListOutput, McpServerSaveInput } from '../../../lib/trpc.tsx';

export type McpServer = McpServerListOutput['servers'][number];
export type McpServerTransport = 'http' | 'stdio';

export interface SecretDraftEntry {
    key: string;
    name: string;
    value: string;
}

export interface McpServerDraft {
    args: string;
    command: string;
    env: SecretDraftEntry[];
    name: string;
    transport: McpServerTransport;
    url: string;
}

export function splitArgs(value: string): string[] {
    return value.split(/\s+/u).filter((part) => part.length > 0);
}

export function joinArgs(args: string[]): string {
    return args.join(' ');
}

export function toEnvRecord(entries: { name: string; value: string }[]): Record<string, string> {
    return Object.fromEntries(
        entries
            .map((entry) => [entry.name.trim(), entry.value] as const)
            .filter(([name]) => name.length > 0)
    );
}

export function mcpServerSummary(server: McpServer): string {
    if (server.transport === 'stdio') {
        const parts = [server.command ?? '', joinArgs(server.args)].filter(Boolean);
        return `stdio: ${parts.join(' ')}`;
    }

    return server.url ? `http: ${urlHost(server.url)}` : server.transport;
}

function urlHost(value: string): string {
    try {
        return new URL(value).host;
    } catch {
        return value;
    }
}

export function createMcpServerDraft(server: McpServer | null): McpServerDraft {
    return {
        args: joinArgs(server?.args ?? []),
        command: server?.command ?? '',
        env: [],
        name: server?.name ?? '',
        transport: server?.transport === 'http' ? 'http' : 'stdio',
        url: server?.url ?? '',
    };
}

export function buildSaveInput(draft: McpServerDraft): McpServerSaveInput {
    const env = toEnvRecord(draft.env);

    return {
        args: draft.transport === 'stdio' ? splitArgs(draft.args) : undefined,
        command: draft.transport === 'stdio' ? draft.command.trim() : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
        name: draft.name.trim(),
        url: draft.transport === 'http' ? draft.url.trim() : undefined,
    };
}

export function createSecretDraftEntry(): SecretDraftEntry {
    return { key: crypto.randomUUID(), name: '', value: '' };
}
