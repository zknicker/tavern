import {
    type AgentRuntimeSkillHubItem,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
} from '@tavern/api';
import { readHermesConnectionOptions } from './connection';
import { HermesHttp } from './http';
import { asRecord, readArray, readString, readStringArray } from './mappers';

export function createSkillHubClient() {
    return new SkillHubClient(new HermesHttp(readHermesConnectionOptions()));
}

/**
 * Engine skill-hub surface: preview and the install-time security scan.
 * Install and uninstall run through the engine CLI instead (see
 * skill-install.ts) because the engine's dashboard endpoints mishandle the
 * installer's confirmation prompts.
 */
export class SkillHubClient {
    readonly #http: HermesHttp;

    constructor(http: HermesHttp) {
        this.#http = http;
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
