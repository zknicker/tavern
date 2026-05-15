import {
    type AgentRuntimeAgent,
    agentRuntimeOpenClawHarnessSchema,
    agentRuntimeThinkingLevelSchema,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readArray,
    readBoolean,
    readString,
    requireString,
} from '../../gateway/records.ts';

export function mapOpenClawAgentRecord(value: unknown): AgentRuntimeAgent {
    const record = asRecord(value);
    const identity = asRecord(record.identity);
    const id = requireString(record, ['id', 'agentId', 'key', 'name'], 'OpenClaw agent');
    const workspaceFolder =
        readString(record, ['workspaceFolder', 'workspace', 'workspacePath', 'folder']) ?? id;
    const enabledSkillIds = readArray(record.enabledSkillIds ?? record.skills)
        .map((skill) => (typeof skill === 'string' ? skill.trim() : null))
        .filter((skill): skill is string => Boolean(skill));

    return {
        avatar: readString(record, ['avatar']),
        emoji: readString(record, ['emoji']),
        enabledSkillIds,
        id,
        isAdmin: readBoolean(record, ['isAdmin', 'admin'], false),
        name:
            readString(record, ['name', 'label', 'displayName']) ??
            readString(identity, ['name']) ??
            id,
        openClawModelName: readOpenClawModelName(record),
        primaryColor:
            readString(record, ['primaryColor', 'color']) ??
            readString(identity, ['primaryColor', 'color']),
        thinkingDefault: readThinkingDefault(record),
        workspaceFolder,
    };
}

export function findOpenClawAgent(records: unknown, agentId: string) {
    return readArray(records)
        .map(asRecord)
        .find((record) => {
            const id = readString(record, ['id', 'agentId', 'key', 'name']);
            return id === agentId;
        });
}

function readOpenClawModelName(record: Record<string, unknown>) {
    const primaryModel = readPrimaryModelRef(record.model);

    if (!primaryModel) {
        return null;
    }

    const separatorIndex = primaryModel.indexOf('/');

    if (separatorIndex < 1 || separatorIndex === primaryModel.length - 1) {
        return null;
    }

    const provider = primaryModel.slice(0, separatorIndex);
    const model = primaryModel.slice(separatorIndex + 1);
    const modelConfig = asRecord(asRecord(record.models)[primaryModel]);
    const modelRuntime = asRecord(modelConfig.agentRuntime);
    const harness = agentRuntimeOpenClawHarnessSchema.safeParse(
        readString(modelRuntime, ['id', 'name'])
    );

    if (!harness.success) {
        return null;
    }

    return {
        harness: harness.data,
        model,
        provider,
    };
}

function readPrimaryModelRef(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }

    const model = asRecord(value);
    return readString(model, ['primary', 'model']);
}

function readThinkingDefault(record: Record<string, unknown>) {
    const parsed = agentRuntimeThinkingLevelSchema.safeParse(
        readString(record, ['thinkingDefault'])
    );
    return parsed.success ? parsed.data : null;
}
