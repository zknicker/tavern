import type { AgentRuntimeSession } from '@tavern/agent-runtime-protocol';
import {
    asRecord,
    readNumber,
    readString,
    requireString,
    toIsoString,
} from '../../gateway/records.ts';
import { resolveOpenClawConversationIdentity } from '../chats/conversation-identity.ts';
import { parseOpenClawSessionKey } from './session-key.ts';

export function mapOpenClawSessionRecord(value: unknown): AgentRuntimeSession {
    const record = asRecord(value);
    const key = requireString(record, ['key', 'sessionKey'], 'OpenClaw session');
    const keyParts = parseOpenClawSessionKey(key);
    const explicitAgentId = readString(record, ['agentId', 'agent']);
    const agentId =
        explicitAgentId && explicitAgentId !== 'default' ? explicitAgentId : keyParts.agentId;

    if (!agentId) {
        throw new Error(`OpenClaw session ${key} is missing a stable agent id.`);
    }
    const title = readString(record, [
        'title',
        'name',
        'displayName',
        'derivedTitle',
        'label',
        'subject',
    ]);
    const conversation = resolveOpenClawConversationIdentity({
        record,
        sessionKey: key,
        sessionTitle: title,
    });

    return {
        agentId,
        sessionId: requireString(record, ['sessionId'], 'OpenClaw session'),
        chatId: conversation.id,
        key,
        lastActivityAt: toIsoString(
            record.lastActivityAt ?? record.updatedAt ?? record.lastMessageAt
        ),
        messageCount: readNumber(record, ['messageCount', 'messages']) ?? 0,
        parentSessionKey: readString(record, ['parentSessionKey', 'parent']),
        platform: conversation.platform,
        sessionRole: readString(record, ['sessionRole', 'role']) === 'worker' ? 'worker' : 'main',
        startedAt: toIsoString(record.startedAt ?? record.createdAt),
        title,
    };
}
