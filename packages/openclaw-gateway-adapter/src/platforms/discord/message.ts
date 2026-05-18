import type { AgentRuntimeSessionMessage } from '@tavern/api';
import { readString } from '../../gateway/records.ts';
import { buildDiscordParticipant } from './participant.ts';

const discordSenderPattern = /^(.+?)\s*\((\d{17,20})\)$/u;

export function resolveOpenClawDiscordMessageParticipant(
    record: Record<string, unknown>
): AgentRuntimeSessionMessage['participant'] {
    const senderName = readString(record, ['senderName', 'name', 'senderLabel']);

    if (!senderName) {
        return null;
    }

    const match = discordSenderPattern.exec(senderName);

    if (!match) {
        return null;
    }

    const [, label = '', externalId = ''] = match;

    return buildDiscordParticipant({
        label: label.trim(),
        observedLabels: [senderName],
        targetId: externalId,
    });
}
