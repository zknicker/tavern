import {
    type AgentRuntimeSkill,
    type AgentRuntimeSkillFile,
    agentRuntimeSkillSchema,
} from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readArray,
    readNumber,
    readString,
    readText,
    toIsoString,
} from '../../gateway/records.ts';
import { mapOpenClawSkillSource } from './shared.ts';

export function mapOpenClawSkill(
    input: unknown,
    fallbackSkillId: string,
    options: {
        contentMarkdown?: string | null;
        files?: AgentRuntimeSkillFile[];
    } = {}
): AgentRuntimeSkill {
    const root = asRecord(input);
    const record = Object.keys(asRecord(root.skill)).length > 0 ? asRecord(root.skill) : root;
    const id = readString(record, ['id', 'slug', 'name']) ?? fallbackSkillId;
    const files = readArray(record.files).flatMap((file) => {
        const fileRecord = asRecord(file);
        const path = readString(fileRecord, ['path', 'name']);

        return path
            ? [
                  {
                      path,
                      sizeBytes: readNumber(fileRecord, ['sizeBytes', 'size']) ?? 0,
                  },
              ]
            : [];
    });

    return agentRuntimeSkillSchema.parse({
        allowedTools: readString(record, ['allowedTools']),
        contentMarkdown:
            options.contentMarkdown ??
            readText(record, ['contentMarkdown', 'content', 'readme']) ??
            '',
        description: readString(record, ['description']),
        files: files.length > 0 ? files : (options.files ?? []),
        id,
        installSource: null,
        name: readString(record, ['name', 'title', 'slug']) ?? id,
        source: mapOpenClawSkillSource(record),
        updatedAt: toIsoString(record.updatedAt) ?? toIsoString(record.installedAt),
    });
}
