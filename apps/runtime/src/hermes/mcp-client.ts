import {
    type AgentRuntimeMcpCatalog,
    type AgentRuntimeMcpCatalogEntry,
    type AgentRuntimeMcpCatalogInstall,
    type AgentRuntimeMcpServer,
    type AgentRuntimeMcpServerCreate,
    type AgentRuntimeMcpServerList,
    type AgentRuntimeMcpServerTestResult,
    type AgentRuntimeSkillHubActionResult,
    agentRuntimeMcpCatalogSchema,
    agentRuntimeMcpServerListSchema,
    agentRuntimeMcpServerSchema,
    agentRuntimeMcpServerTestResultSchema,
} from '@tavern/api';
import { readHermesConnectionOptions } from './connection';
import { awaitEngineAction, type EngineActionOptions } from './engine-actions';
import { HermesHttp } from './http';
import { asRecord, readArray, readString, readStringArray } from './mappers';

export function createMcpClient(options?: EngineActionOptions) {
    return new McpClient(new HermesHttp(readHermesConnectionOptions()), options);
}

/**
 * Engine MCP surface: custom HTTP/stdio servers plus the curated catalog with
 * one-click install. Catalog entries that need a git bootstrap install through
 * the engine's background action path; this client waits for that action so
 * callers see one synchronous result.
 */
export class McpClient {
    readonly #actionOptions: EngineActionOptions | undefined;
    readonly #http: HermesHttp;

    constructor(http: HermesHttp, options?: EngineActionOptions) {
        this.#http = http;
        this.#actionOptions = options;
    }

    async listServers(): Promise<AgentRuntimeMcpServerList> {
        const response = asRecord(await this.#http.get('/api/mcp/servers'));
        return agentRuntimeMcpServerListSchema.parse({
            servers: readArray(response, ['servers']).map(mapMcpServer),
        });
    }

    async addServer(input: AgentRuntimeMcpServerCreate): Promise<AgentRuntimeMcpServer> {
        const response = await this.#http.postJson('/api/mcp/servers', input);
        return agentRuntimeMcpServerSchema.parse(mapMcpServer(response));
    }

    async removeServer(name: string): Promise<{ ok: boolean }> {
        await this.#http.deleteJson(`/api/mcp/servers/${encodeURIComponent(name)}`);
        return { ok: true };
    }

    async testServer(name: string): Promise<AgentRuntimeMcpServerTestResult> {
        const response = asRecord(
            await this.#http.postJson(`/api/mcp/servers/${encodeURIComponent(name)}/test`, {})
        );
        return agentRuntimeMcpServerTestResultSchema.parse({
            error: readString(response, ['error']) ?? null,
            ok: response.ok === true,
            tools: readArray(response, ['tools']).map((tool) => {
                const record = asRecord(tool);
                return {
                    description: readString(record, ['description']) ?? '',
                    name: readString(record, ['name']) ?? '',
                };
            }),
        });
    }

    async setServerEnabled(name: string, enabled: boolean): Promise<{ ok: boolean }> {
        await this.#http.putJson(`/api/mcp/servers/${encodeURIComponent(name)}/enabled`, {
            enabled,
        });
        return { ok: true };
    }

    async getCatalog(): Promise<AgentRuntimeMcpCatalog> {
        const response = asRecord(await this.#http.get('/api/mcp/catalog'));
        return agentRuntimeMcpCatalogSchema.parse({
            entries: readArray(response, ['entries']).map(mapCatalogEntry),
        });
    }

    async installCatalogEntry(
        input: AgentRuntimeMcpCatalogInstall
    ): Promise<AgentRuntimeSkillHubActionResult> {
        const response = asRecord(
            await this.#http.postJson('/api/mcp/catalog/install', {
                enable: input.enable,
                env: input.env ?? {},
                name: input.name,
            })
        );
        if (response.background === true) {
            return await awaitEngineAction(this.#http, 'mcp-install', this.#actionOptions);
        }
        return { exitCode: response.ok === true ? 0 : 1, log: [], ok: response.ok === true };
    }
}

function mapMcpServer(value: unknown): AgentRuntimeMcpServer {
    const record = asRecord(value);
    const transport = readString(record, ['transport']);
    return {
        args: readStringArray(record.args),
        command: readString(record, ['command']) ?? null,
        enabled: record.enabled !== false,
        name: readString(record, ['name']) ?? 'unknown',
        transport: transport === 'http' || transport === 'stdio' ? transport : 'unknown',
        url: readString(record, ['url']) ?? null,
    };
}

function mapCatalogEntry(value: unknown): AgentRuntimeMcpCatalogEntry {
    const record = asRecord(value);
    return {
        authType: readString(record, ['auth_type']) ?? 'none',
        description: readString(record, ['description']) ?? '',
        enabled: record.enabled === true,
        installed: record.installed === true,
        name: readString(record, ['name']) ?? 'unknown',
        needsInstall: record.needs_install === true,
        requiredEnv: readArray(record, ['required_env']).map((entry) => {
            const env = asRecord(entry);
            const name = readString(env, ['name']) ?? '';
            return {
                name,
                prompt: readString(env, ['prompt']) ?? name,
                required: env.required !== false,
            };
        }),
        source: readString(record, ['source']) ?? '',
        transport: readString(record, ['transport']) ?? 'unknown',
    };
}
