import { sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';

const discordIdInParensPattern = /\((\d{17,20})\)$/;

export interface AgentDiscordBinding {
    accountName: string;
    agentId: string;
}

function parseApplicationIdFromToken(token: string): string | null {
    const firstSegment = token.split('.')[0];

    if (!firstSegment) {
        return null;
    }

    try {
        const decoded = atob(firstSegment);
        return /^\d{17,20}$/.test(decoded) ? decoded : null;
    } catch {
        return null;
    }
}

export function buildDiscordBindings(config: Record<string, unknown>): AgentDiscordBinding[] {
    const channels = config.channels as Record<string, unknown> | undefined;
    const discord = channels?.discord as Record<string, unknown> | undefined;
    const accounts = discord?.accounts as Record<string, Record<string, unknown>> | undefined;
    const bindings = Array.isArray(config.bindings) ? config.bindings : [];

    if (!accounts || bindings.length === 0) {
        return [];
    }

    const result: AgentDiscordBinding[] = [];

    for (const binding of bindings) {
        if (!(binding && typeof binding === 'object' && !Array.isArray(binding))) {
            continue;
        }

        const agentId = typeof binding.agentId === 'string' ? binding.agentId : null;
        const match = binding.match as Record<string, unknown> | undefined;

        if (!agentId || match?.channel !== 'discord' || typeof match.connectionId !== 'string') {
            continue;
        }

        const account = accounts[match.connectionId];

        if (!account) {
            continue;
        }

        const token = typeof account.token === 'string' ? account.token : null;
        const discordUserId = token ? parseApplicationIdFromToken(token) : null;

        if (discordUserId) {
            result.push({ accountName: discordUserId, agentId });
        } else {
            const accountName =
                typeof account.name === 'string' ? account.name : match.connectionId;
            result.push({ accountName, agentId });
        }
    }

    return result;
}

export function buildDiscordUserIdMap(
    bindings: AgentDiscordBinding[],
    senderLabelDiscordIds: Map<string, string>
): Map<string, string> {
    const agentIdToDiscordUserId = new Map<string, string>();

    for (const binding of bindings) {
        if (/^\d{17,20}$/.test(binding.accountName)) {
            agentIdToDiscordUserId.set(binding.agentId, binding.accountName);
            continue;
        }

        const discordId = senderLabelDiscordIds.get(binding.accountName.toLowerCase());

        if (discordId) {
            agentIdToDiscordUserId.set(binding.agentId, discordId);
        }
    }

    return agentIdToDiscordUserId;
}

export async function querySenderLabelDiscordIds(): Promise<Map<string, string>> {
    const displayNameToDiscordId = new Map<string, string>();

    const rows = await db
        .selectDistinct({ senderLabel: sessionMessagesTable.senderLabel })
        .from(sessionMessagesTable)
        .where(
            sql`${sessionMessagesTable.role} = 'user' AND ${sessionMessagesTable.senderLabel} GLOB '*([0-9]*)'`
        );

    for (const row of rows) {
        const label = row.senderLabel;

        if (!label) {
            continue;
        }

        const match = label.match(discordIdInParensPattern);

        if (!match?.[1]) {
            continue;
        }

        const displayName = label.slice(0, label.lastIndexOf('(')).trim().toLowerCase();
        displayNameToDiscordId.set(displayName, match[1]);
    }

    return displayNameToDiscordId;
}
