import {
    type AgentRuntimeSkillList,
    agentRuntimeSkillListSchema,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readArray,
    readBoolean,
    readRecordArray,
    readString,
    requireString,
    toIsoString,
} from '../../gateway/records.ts';
import { mapOpenClawSkillSource } from './shared.ts';

function readStringArray(value: unknown) {
    return readArray(value)
        .map((item) => (typeof item === 'string' ? item.trim() : null))
        .filter((item): item is string => Boolean(item));
}

function readRequirements(value: unknown) {
    const record = asRecord(value);
    return {
        anyBins: readStringArray(record.anyBins),
        bins: readStringArray(record.bins),
        config: readStringArray(record.config),
        env: readStringArray(record.env),
        os: readStringArray(record.os),
    };
}

function readConfigChecks(value: unknown) {
    return readArray(value).flatMap((item) => {
        const record = asRecord(item);
        const path = readString(record, ['path']);
        if (!path) {
            return [];
        }
        return [
            {
                path,
                satisfied: readBoolean(record, ['satisfied']),
            },
        ];
    });
}

function readInstallOptions(value: unknown) {
    return readArray(value).flatMap((item) => {
        const record = asRecord(item);
        const id = readString(record, ['id']);
        const kind = readString(record, ['kind']);
        const label = readString(record, ['label']);
        if (!(id && kind && label)) {
            return [];
        }
        return [
            {
                bins: readStringArray(record.bins),
                id,
                kind,
                label,
            },
        ];
    });
}

export function mapOpenClawSkillList(input: unknown): AgentRuntimeSkillList {
    const record = asRecord(input);
    const skills = readRecordArray(record, ['skills', 'items', 'entries']).map((skill) => ({
        allowedTools: readString(skill, ['allowedTools']),
        baseDir: readString(skill, ['baseDir']),
        bundled: readBoolean(skill, ['bundled']),
        commandVisible: readBoolean(skill, ['commandVisible']),
        configChecks: readConfigChecks(skill.configChecks),
        description: readString(skill, ['description']),
        disabled: readBoolean(skill, ['disabled']),
        eligible: readBoolean(skill, ['eligible']),
        filePath: readString(skill, ['filePath']),
        id: requireString(skill, ['id', 'slug', 'name'], 'OpenClaw skill'),
        install: readInstallOptions(skill.install),
        missing: readRequirements(skill.missing),
        modelVisible: readBoolean(skill, ['modelVisible']),
        name: requireString(skill, ['name', 'title', 'slug'], 'OpenClaw skill'),
        primaryEnv: readString(skill, ['primaryEnv']),
        requirements: readRequirements(skill.requirements),
        runtimeSource: readString(skill, ['source']),
        skillKey: readString(skill, ['skillKey']),
        source: mapOpenClawSkillSource(skill),
        updatedAt: toIsoString(skill.updatedAt) ?? toIsoString(skill.installedAt),
        userInvocable: readBoolean(skill, ['userInvocable']),
    }));

    return agentRuntimeSkillListSchema.parse({ skills });
}
