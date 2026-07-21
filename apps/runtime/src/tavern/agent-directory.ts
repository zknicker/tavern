import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { type ResolvedAgentTarget, resolveAgentTarget } from './agent-targets.ts';
import { getStoredAgent, listStoredAgents } from './agents-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';
import { isValidHandle } from './handles.ts';

export function readAgentServerInfo(
    agentId: string,
    input: {
        agents?: boolean;
        channels?: boolean;
        humans?: boolean;
        joined?: boolean;
        limit?: number;
        offset?: number;
        query?: string;
    },
    db: Database = getDb()
) {
    const noKinds = !(input.agents || input.channels || input.humans);
    const limit = clamp(input.limit, 50, 100);
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const query = input.query?.trim().toLowerCase() ?? '';
    const channels = noKinds || input.channels ? listChannels(agentId, input.joined, db) : [];
    const agents = noKinds || input.agents ? listAgents(db) : [];
    const humans = noKinds || input.humans ? listHumans(db) : [];
    const filteredChannels = filterRoster(channels, query);
    const filteredAgents = filterRoster(agents, query);
    const filteredHumans = filterRoster(humans, query);
    return {
        agents: page(filteredAgents, offset, limit),
        channels: page(filteredChannels, offset, limit),
        hasMore: {
            agents: hasMore(filteredAgents, offset, limit),
            channels: hasMore(filteredChannels, offset, limit),
            humans: hasMore(filteredHumans, offset, limit),
        },
        humans: page(filteredHumans, offset, limit),
        limit,
        offset,
        total: {
            agents: filteredAgents.length,
            channels: filteredChannels.length,
            humans: filteredHumans.length,
        },
    };
}

export function readAgentChannelInfo(agentId: string, target: string, db: Database = getDb()) {
    const resolved = resolveAgentTarget({ agentId, requireMembership: false, target }, db);
    assertChannelTarget(resolved);
    return channelSummary(agentId, resolved.chat.id, resolved.chat.title ?? '', db);
}

export function readAgentChannelMembers(agentId: string, target: string, db: Database = getDb()) {
    const resolved = resolveAgentTarget({ agentId, target }, db);
    assertChannelTarget(resolved);
    const members = resolved.chat.participants.map((participant) => {
        const metadataAgentId = participant.metadata.agentId;
        const memberAgentId =
            typeof metadataAgentId === 'string'
                ? metadataAgentId
                : participant.kind === 'agent'
                  ? participant.id
                  : null;
        const agent = memberAgentId ? getStoredAgent(memberAgentId, db) : null;
        return {
            description: agent?.bio ?? null,
            handle: agent?.name ?? participant.label,
            role: participant.kind === 'agent' ? 'agent' : 'human',
        };
    });
    return { members, target: resolved.target };
}

function listChannels(agentId: string, joined: boolean | undefined, db: Database) {
    const rows = db
        .prepare(`SELECT id, title FROM chats WHERE kind = 'channel' ORDER BY lower(title), id`)
        .all() as Array<{ id: string; title: string | null }>;
    return rows
        .map((row) => channelSummary(agentId, row.id, row.title ?? '', db))
        .filter((row) => joined === undefined || row.joined === joined);
}

function channelSummary(agentId: string, chatId: string, handle: string, db: Database) {
    const participantId = createAgentParticipantId(agentId);
    const row = db
        .prepare(
            `SELECT metadata_json,
                    EXISTS(SELECT 1 FROM chat_participants
                           WHERE chat_id = $chatId AND id = $participantId) AS joined,
                    (SELECT COUNT(*) FROM chat_participants WHERE chat_id = $chatId) AS member_count
             FROM chats WHERE id = $chatId`
        )
        .get(namedParams({ chatId, participantId })) as {
        joined: 0 | 1;
        member_count: number;
        metadata_json: string;
    };
    const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
    const tavern = readRecord(metadata.tavern);
    const description =
        typeof tavern.description === 'string'
            ? tavern.description
            : typeof metadata.description === 'string'
              ? metadata.description
              : null;
    return {
        description,
        handle,
        joined: row.joined === 1,
        memberCount: row.member_count,
    };
}

function listAgents(db: Database) {
    return listStoredAgents(db).agents.map((agent) => ({
        description: agent.bio ?? null,
        handle: agent.name,
    }));
}

function listHumans(db: Database) {
    const rows = db
        .prepare(
            `SELECT id, name AS handle FROM identity_users WHERE name IS NOT NULL
             UNION ALL
             SELECT DISTINCT id, label AS handle FROM chat_participants
             WHERE kind IN ('user', 'external') AND label IS NOT NULL`
        )
        .all() as Array<{ handle: string; id: string }>;
    const byId = new Map<string, { description: null; handle: string }>();
    for (const row of rows) {
        if (isValidHandle(row.handle)) {
            byId.set(row.id, { description: null, handle: row.handle });
        }
    }
    return [...byId.values()].sort((a, b) => a.handle.localeCompare(b.handle));
}

function filterRoster<T extends { description: string | null; handle: string }>(
    rows: T[],
    query: string
) {
    if (!query) {
        return rows;
    }
    return rows.filter(
        (row) =>
            row.handle.toLowerCase().includes(query) ||
            row.description?.toLowerCase().includes(query)
    );
}

function page<T>(rows: T[], offset: number, limit: number) {
    return rows.slice(offset, offset + limit);
}

function hasMore(rows: unknown[], offset: number, limit: number): boolean {
    return offset + limit < rows.length;
}

function clamp(value: number | undefined, fallback: number, max: number) {
    return Math.min(max, Math.max(1, Math.floor(value ?? fallback)));
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function assertChannelTarget(target: ResolvedAgentTarget): void {
    if (target.chat.kind !== 'channel') {
        throw new AgentApiError('TARGET_NOT_FOUND', 'A channel target is required.', 404);
    }
}
