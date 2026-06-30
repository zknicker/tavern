import { updateAgentTools } from '../agent-settings/service.ts';
import { getAgent as getCatalogAgent } from './catalog.ts';
import { buildAgentToolPolicy } from './tool-policy-defaults.ts';

export async function saveAgentToolPolicy(input: { agentId: string; tools: string[] }) {
    const agent = await getCatalogAgent(input.agentId);

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const tools = normalizeToolNames(input.tools);
    await updateAgentTools({ agentId: agent.id, tools });

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
