import type { AgentRuntimeSkillSummary } from '@tavern/api';
import { readBoolean, readString } from '../../gateway/records.ts';

export function mapOpenClawSkillSource(
    record: Record<string, unknown>
): AgentRuntimeSkillSummary['source'] {
    const source = readString(record, ['source'])?.toLowerCase() ?? '';

    if (readBoolean(record, ['bundled']) || source === 'builtin' || source === 'openclaw-bundled') {
        return 'builtin';
    }

    return 'installed';
}
