import { applyOpenClawConfig } from '../openclaw-config/service.ts';
import { getAgent as getAgentRecord } from '../storage/agents.ts';
import { getOpenClawConfigSnapshot } from '../storage/openclaw-config-snapshots.ts';
import { buildAgentToolPolicy } from './tool-policy-defaults.ts';

export async function saveAgentToolPolicy(input: { agentId: string; tools: string[] }) {
    const agentRecord = await getAgentRecord(input.agentId);

    if (!agentRecord) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const snapshot = await getOpenClawConfigSnapshot(agentRecord.runtimeId);
    if (!snapshot) {
        throw new Error('Runtime config has not synced yet.');
    }

    const config = JSON.parse(snapshot.configJson) as Record<string, unknown>;
    const tools = normalizeToolNames(input.tools);
    const nextConfig = writeAgentTools(config, {
        agentId: agentRecord.id,
        agentName: agentRecord.name,
        tools,
    });

    await applyOpenClawConfig({
        baseHash: snapshot.hash,
        config: nextConfig,
        runtimeId: agentRecord.runtimeId,
    });

    return { tools };
}

export function writeAgentTools(
    config: Record<string, unknown>,
    input: {
        agentId: string;
        agentName: string;
        tools: string[];
    }
) {
    const agents = readRecord(config.agents);
    const list = readRecordArray(agents.list);
    const existing = list.find((entry) => readString(entry.id) === input.agentId);
    const nextEntry = writeAgentEntryTools(
        existing ?? {
            id: input.agentId,
            name: input.agentName,
        },
        input.tools
    );

    return {
        ...config,
        agents: {
            ...agents,
            list: existing
                ? list.map((entry) => (readString(entry.id) === input.agentId ? nextEntry : entry))
                : [...list, nextEntry],
        },
    };
}

function writeAgentEntryTools(entry: Record<string, unknown>, tools: string[]) {
    const currentTools = readRecord(entry.tools);
    const policy = buildAgentToolPolicy(tools);

    const {
        allow: _allow,
        alsoAllow: _alsoAllow,
        deny: _deny,
        profile: _profile,
        ...otherTools
    } = currentTools;

    return {
        ...entry,
        tools: {
            ...otherTools,
            ...policy,
        },
    };
}

function normalizeToolNames(values: string[]) {
    const seen = new Set<string>();
    const tools: string[] = [];

    for (const value of values) {
        const normalized = value
            .trim()
            .toLowerCase()
            .replaceAll(/^,+|,+$/g, '');
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        if (/[\s,]/u.test(normalized)) {
            throw new Error(`Tool names cannot contain spaces or commas: ${normalized}.`);
        }
        if (normalized.length > 128) {
            throw new Error(`Tool names must be 128 characters or fewer: ${normalized}.`);
        }

        seen.add(normalized);
        tools.push(normalized);
    }

    return tools;
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readRecordArray(value: unknown) {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
