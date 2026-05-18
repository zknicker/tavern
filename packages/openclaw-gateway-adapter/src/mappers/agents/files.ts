import {
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
} from '@tavern/api';
import {
    asRecord,
    readArray,
    readBoolean,
    readNumber,
    readString,
    requireText,
    toIsoString,
} from '../../gateway/records.ts';

export function mapOpenClawAgentFileList(input: unknown): AgentRuntimeAgentFileList {
    const record = asRecord(input);
    const files = readArray(record.files ?? input)
        .map((file) => {
            if (typeof file === 'string') {
                return {
                    mediaType: 'text/markdown',
                    path: file.trim(),
                    sizeBytes: null,
                    updatedAt: null,
                };
            }

            const fileRecord = asRecord(file);

            return {
                mediaType: readString(fileRecord, ['mediaType', 'mimeType']),
                path: readString(fileRecord, ['path', 'name']),
                sizeBytes: readNumber(fileRecord, ['sizeBytes', 'size']),
                updatedAt: toIsoString(fileRecord.updatedAt ?? fileRecord.mtime),
            };
        })
        .filter((file): file is NonNullable<typeof file> & { path: string } => Boolean(file.path));

    return agentRuntimeAgentFileListSchema.parse({ files });
}

export function mapOpenClawAgentFileContent(input: {
    content: unknown;
    path: string;
}): AgentRuntimeAgentFileContent {
    const record = asRecord(input.content);
    const file = asRecord(record.file);
    const contentRecord = Object.keys(file).length > 0 ? file : record;
    const isMissing = readBoolean(contentRecord, ['missing']);

    return agentRuntimeAgentFileContentSchema.parse({
        content:
            typeof input.content === 'string'
                ? input.content
                : isMissing
                  ? ''
                  : requireText(contentRecord, ['content', 'text'], 'OpenClaw agent file'),
        mediaType: readString(contentRecord, ['mediaType', 'mimeType']) ?? 'text/markdown',
        path: readString(contentRecord, ['path', 'name']) ?? input.path,
        sizeBytes: readNumber(contentRecord, ['sizeBytes', 'size']),
        updatedAt: toIsoString(contentRecord.updatedAt ?? contentRecord.mtime),
    });
}

export function mapTavernAgentFileToOpenClaw(input: AgentRuntimeAgentFileContent) {
    return {
        content: input.content,
        name: toOpenClawFileName(input.path),
    };
}

export function toOpenClawFileName(path: string) {
    return path.split('/').filter(Boolean).at(-1) ?? path;
}
