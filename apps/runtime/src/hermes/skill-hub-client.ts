import {
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeSkillHubCatalog,
    type AgentRuntimeSkillHubItem,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    type AgentRuntimeSkillHubSearchInput,
    type AgentRuntimeSkillHubSearchResult,
    agentRuntimeSkillHubCatalogSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
    agentRuntimeSkillHubSearchResultSchema,
} from '@tavern/api';
import { readHermesConnectionOptions } from './connection';
import { HermesHttp } from './http';
import { asRecord, readArray, readString, readStringArray } from './mappers';

const actionPollIntervalMs = 1000;
const actionTimeoutMs = 180_000;

export function createSkillHubClient(options?: { pollIntervalMs?: number; timeoutMs?: number }) {
    return new SkillHubClient(new HermesHttp(readHermesConnectionOptions()), options);
}

/**
 * Engine skill-hub surface: catalog browse, multi-source search, preview,
 * install-time security scan, and install/uninstall. Install and uninstall are
 * engine background actions; this client owns waiting for the action to exit
 * so callers see one synchronous result.
 */
export class SkillHubClient {
    readonly #http: HermesHttp;
    readonly #pollIntervalMs: number;
    readonly #timeoutMs: number;

    constructor(http: HermesHttp, options?: { pollIntervalMs?: number; timeoutMs?: number }) {
        this.#http = http;
        this.#pollIntervalMs = options?.pollIntervalMs ?? actionPollIntervalMs;
        this.#timeoutMs = options?.timeoutMs ?? actionTimeoutMs;
    }

    async getCatalog(): Promise<AgentRuntimeSkillHubCatalog> {
        const response = asRecord(await this.#http.get('/api/skills/hub/sources'));
        return agentRuntimeSkillHubCatalogSchema.parse({
            featured: readArray(response, ['featured']).map(mapHubItem),
            indexAvailable: response.index_available === true,
            installed: mapInstalledEntries(response.installed),
            sources: readArray(response, ['sources']).map(mapHubSource),
        });
    }

    async search(
        input: AgentRuntimeSkillHubSearchInput
    ): Promise<AgentRuntimeSkillHubSearchResult> {
        const params = new URLSearchParams({ q: input.query });
        if (input.source) {
            params.set('source', input.source);
        }
        if (input.limit !== undefined) {
            params.set('limit', String(input.limit));
        }
        const response = asRecord(
            await this.#http.get(`/api/skills/hub/search?${params.toString()}`)
        );
        return agentRuntimeSkillHubSearchResultSchema.parse({
            installed: mapInstalledEntries(response.installed),
            results: readArray(response, ['results']).map(mapHubItem),
            sourceCounts: mapCountRecord(response.source_counts),
            timedOut: readStringArray(response.timed_out),
        });
    }

    async preview(identifier: string): Promise<AgentRuntimeSkillHubPreview> {
        const params = new URLSearchParams({ identifier });
        const response = asRecord(
            await this.#http.get(`/api/skills/hub/preview?${params.toString()}`)
        );
        return agentRuntimeSkillHubPreviewSchema.parse({
            ...mapHubItem(response),
            files: readStringArray(response.files),
            skillMd: typeof response.skill_md === 'string' ? response.skill_md : '',
        });
    }

    async scan(identifier: string): Promise<AgentRuntimeSkillHubScan> {
        const params = new URLSearchParams({ identifier });
        const response = asRecord(
            await this.#http.get(`/api/skills/hub/scan?${params.toString()}`)
        );
        return agentRuntimeSkillHubScanSchema.parse({
            findings: readArray(response, ['findings']).map(mapScanFinding),
            identifier: readString(response, ['identifier']) ?? identifier,
            name: readString(response, ['name']) ?? identifier,
            policy: readString(response, ['policy']) ?? 'block',
            policyReason: readString(response, ['policy_reason']) ?? '',
            severityCounts: mapCountRecord(response.severity_counts),
            source: readString(response, ['source']) ?? '',
            summary: readString(response, ['summary']) ?? '',
            trustLevel: readString(response, ['trust_level']) ?? 'community',
            verdict: readString(response, ['verdict']) ?? '',
        });
    }

    async install(identifier: string): Promise<AgentRuntimeSkillHubActionResult> {
        await this.#http.postJson('/api/skills/hub/install', { identifier });
        return await this.#awaitAction('skills-install');
    }

    async uninstall(name: string): Promise<AgentRuntimeSkillHubActionResult> {
        await this.#http.postJson('/api/skills/hub/uninstall', { name });
        return await this.#awaitAction('skills-uninstall');
    }

    async #awaitAction(name: string): Promise<AgentRuntimeSkillHubActionResult> {
        const deadline = Date.now() + this.#timeoutMs;
        while (Date.now() < deadline) {
            await sleep(this.#pollIntervalMs);
            const status = asRecord(
                await this.#http.get(`/api/actions/${encodeURIComponent(name)}/status`)
            );
            if (status.running === true) {
                continue;
            }
            const exitCode = typeof status.exit_code === 'number' ? status.exit_code : null;
            return {
                exitCode,
                log: readStringArray(status.lines),
                ok: exitCode === 0,
            };
        }
        throw new Error(`Skill hub action "${name}" timed out.`);
    }
}

function mapHubItem(value: unknown): AgentRuntimeSkillHubItem {
    const record = asRecord(value);
    const trustLevel = readString(record, ['trust_level']);
    return {
        description: readString(record, ['description']) ?? '',
        identifier: readString(record, ['identifier']) ?? '',
        name: readString(record, ['name']) ?? '',
        repo: readString(record, ['repo']) ?? null,
        source: readString(record, ['source']) ?? 'unknown',
        tags: readStringArray(record.tags),
        trustLevel: trustLevel === 'builtin' || trustLevel === 'trusted' ? trustLevel : 'community',
    };
}

function mapHubSource(value: unknown) {
    const record = asRecord(value);
    return {
        ...(typeof record.available === 'boolean' ? { available: record.available } : {}),
        id: readString(record, ['id']) ?? 'unknown',
        label: readString(record, ['label', 'id']) ?? 'Unknown',
        ...(typeof record.rate_limited === 'boolean' ? { rateLimited: record.rate_limited } : {}),
    };
}

function mapInstalledEntries(value: unknown) {
    return Object.fromEntries(
        Object.entries(asRecord(value)).map(([identifier, entry]) => {
            const record = asRecord(entry);
            return [
                identifier,
                {
                    name: readString(record, ['name']) ?? null,
                    scanVerdict: readString(record, ['scan_verdict']) ?? null,
                    trustLevel: readString(record, ['trust_level']) ?? null,
                },
            ];
        })
    );
}

function mapScanFinding(value: unknown) {
    const record = asRecord(value);
    const severity = readString(record, ['severity']);
    return {
        category: readString(record, ['category']) ?? '',
        description: readString(record, ['description']) ?? '',
        file: readString(record, ['file']) ?? null,
        line: typeof record.line === 'number' && Number.isInteger(record.line) ? record.line : null,
        severity:
            severity === 'critical' || severity === 'high' || severity === 'medium'
                ? severity
                : 'low',
    };
}

function mapCountRecord(value: unknown) {
    return Object.fromEntries(
        Object.entries(asRecord(value)).flatMap(([key, count]) =>
            typeof count === 'number' && Number.isFinite(count) ? [[key, count]] : []
        )
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
