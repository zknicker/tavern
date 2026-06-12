import {
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeToolsetConfig,
    type AgentRuntimeToolsetEnvUpdate,
    type AgentRuntimeToolsetEnvUpdateResult,
    type AgentRuntimeToolsetProvider,
    type AgentRuntimeToolsetProviderSelect,
    type AgentRuntimeToolsetProviderSelectResult,
    agentRuntimeToolsetConfigSchema,
    agentRuntimeToolsetEnvUpdateResultSchema,
    agentRuntimeToolsetProviderSelectResultSchema,
} from '@tavern/api';
import { readHermesConnectionOptions } from './connection';
import { awaitEngineAction, type EngineActionOptions } from './engine-actions';
import { HermesHttp } from './http';
import { asRecord, readArray, readString } from './mappers';

export function createToolsetSetupClient(options?: EngineActionOptions) {
    return new ToolsetSetupClient(new HermesHttp(readHermesConnectionOptions()), options);
}

/**
 * Engine toolset setup surface: the provider matrix behind a toolset's
 * "needs setup" state, provider selection, env key writes, and the provider's
 * post-setup install action.
 */
export class ToolsetSetupClient {
    readonly #actionOptions: EngineActionOptions | undefined;
    readonly #http: HermesHttp;

    constructor(http: HermesHttp, options?: EngineActionOptions) {
        this.#http = http;
        this.#actionOptions = options;
    }

    async getConfig(toolsetId: string): Promise<AgentRuntimeToolsetConfig> {
        const response = asRecord(
            await this.#http.get(`/api/tools/toolsets/${encodeURIComponent(toolsetId)}/config`)
        );
        return agentRuntimeToolsetConfigSchema.parse({
            activeProvider: readString(response, ['active_provider']) ?? null,
            hasCategory: response.has_category === true,
            name: readString(response, ['name']) ?? toolsetId,
            providers: readArray(response, ['providers']).map(mapToolsetProvider),
        });
    }

    async selectProvider(
        toolsetId: string,
        input: AgentRuntimeToolsetProviderSelect
    ): Promise<AgentRuntimeToolsetProviderSelectResult> {
        const response = await this.#http.putJson(
            `/api/tools/toolsets/${encodeURIComponent(toolsetId)}/provider`,
            { provider: input.provider }
        );
        return agentRuntimeToolsetProviderSelectResultSchema.parse(response);
    }

    async saveEnv(
        toolsetId: string,
        input: AgentRuntimeToolsetEnvUpdate
    ): Promise<AgentRuntimeToolsetEnvUpdateResult> {
        const response = asRecord(
            await this.#http.putJson(`/api/tools/toolsets/${encodeURIComponent(toolsetId)}/env`, {
                env: input.env,
            })
        );
        return agentRuntimeToolsetEnvUpdateResultSchema.parse({
            isSet: asRecord(response.is_set),
            name: readString(response, ['name']) ?? toolsetId,
            ok: response.ok === true,
            saved: readArray(response, ['saved']),
            skipped: readArray(response, ['skipped']),
        });
    }

    async runPostSetup(toolsetId: string, key: string): Promise<AgentRuntimeSkillHubActionResult> {
        await this.#http.postJson(
            `/api/tools/toolsets/${encodeURIComponent(toolsetId)}/post-setup`,
            { key }
        );
        return await awaitEngineAction(this.#http, 'tools-post-setup', this.#actionOptions);
    }
}

function mapToolsetProvider(value: unknown): AgentRuntimeToolsetProvider {
    const record = asRecord(value);
    return {
        badge: readString(record, ['badge']) ?? '',
        envVars: readArray(record, ['env_vars']).map(mapToolsetEnvVar),
        isActive: record.is_active === true,
        name: readString(record, ['name']) ?? 'unknown',
        postSetup: readString(record, ['post_setup']) ?? null,
        requiresEngineAuth: record.requires_nous_auth === true,
        tag: readString(record, ['tag']) ?? '',
    };
}

function mapToolsetEnvVar(value: unknown) {
    const record = asRecord(value);
    const key = readString(record, ['key']) ?? '';
    return {
        defaultValue: readString(record, ['default']) ?? null,
        isSet: record.is_set === true,
        key,
        prompt: readString(record, ['prompt']) ?? key,
        url: readString(record, ['url']) ?? null,
    };
}
