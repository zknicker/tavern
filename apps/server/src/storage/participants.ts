import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
    type ParticipantInsert,
    type ParticipantLabelInsert,
    participantLabelsTable,
    participantsTable,
    profileParticipantsTable,
    profilesTable,
} from '../db/schema.ts';
import {
    extractObservedExternalId,
    normalizeObservedParticipantLabel,
} from '../participants/observed.ts';

export interface Profile {
    avatar: string | null;
    displayName: string | null;
    id: string;
    primaryColor: string | null;
}

export interface Participant {
    accountKey: string | null;
    externalId: string | null;
    id: string;
    labels: string[];
    lastSeenAt: string | null;
    linkedProfile: Profile | null;
    observedName: string;
    provider: string;
}

function compareOptionalTimestamp(left: string | null, right: string | null) {
    if (!(left || right)) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    return right.localeCompare(left);
}

function compareParticipants(left: Participant, right: Participant) {
    const linkedComparison =
        Number(Boolean(right.linkedProfile)) - Number(Boolean(left.linkedProfile));

    if (linkedComparison !== 0) {
        return linkedComparison;
    }

    const lastSeenAtComparison = compareOptionalTimestamp(left.lastSeenAt, right.lastSeenAt);

    if (lastSeenAtComparison !== 0) {
        return lastSeenAtComparison;
    }

    return left.observedName.localeCompare(right.observedName);
}

export async function listParticipants() {
    const rows = await db
        .select({
            accountKey: participantsTable.accountKey,
            externalId: participantsTable.externalId,
            id: participantsTable.id,
            label: participantLabelsTable.label,
            lastSeenAt: participantsTable.lastSeenAt,
            observedName: participantsTable.observedName,
            profileAvatar: profilesTable.avatar,
            profileDisplayName: profilesTable.displayName,
            profileId: profilesTable.id,
            profilePrimaryColor: profilesTable.primaryColor,
            provider: participantsTable.provider,
        })
        .from(participantsTable)
        .leftJoin(
            participantLabelsTable,
            eq(participantLabelsTable.participantId, participantsTable.id)
        )
        .leftJoin(
            profileParticipantsTable,
            eq(profileParticipantsTable.participantId, participantsTable.id)
        )
        .leftJoin(profilesTable, eq(profilesTable.id, profileParticipantsTable.profileId))
        .orderBy(asc(participantsTable.observedName), asc(participantsTable.id));

    return hydrateParticipants(rows).sort(compareParticipants);
}

export async function getParticipant(participantId: string) {
    const rows = await db
        .select({
            accountKey: participantsTable.accountKey,
            externalId: participantsTable.externalId,
            id: participantsTable.id,
            label: participantLabelsTable.label,
            lastSeenAt: participantsTable.lastSeenAt,
            observedName: participantsTable.observedName,
            profileAvatar: profilesTable.avatar,
            profileDisplayName: profilesTable.displayName,
            profileId: profilesTable.id,
            profilePrimaryColor: profilesTable.primaryColor,
            provider: participantsTable.provider,
        })
        .from(participantsTable)
        .leftJoin(
            participantLabelsTable,
            eq(participantLabelsTable.participantId, participantsTable.id)
        )
        .leftJoin(
            profileParticipantsTable,
            eq(profileParticipantsTable.participantId, participantsTable.id)
        )
        .leftJoin(profilesTable, eq(profilesTable.id, profileParticipantsTable.profileId))
        .where(eq(participantsTable.id, participantId));

    return hydrateParticipants(rows)[0] ?? null;
}

export async function resolveParticipantIdsForNormalizedLabels(normalizedLabels: string[]) {
    const uniqueLabels = [
        ...new Set(normalizedLabels.map((label) => label.trim()).filter(Boolean)),
    ];

    if (uniqueLabels.length === 0) {
        return new Map<string, string>();
    }

    const rows = await db
        .select({
            normalizedLabel: participantLabelsTable.normalizedLabel,
            participantId: participantLabelsTable.participantId,
        })
        .from(participantLabelsTable)
        .where(inArray(participantLabelsTable.normalizedLabel, uniqueLabels));

    const byLabel = new Map<string, Set<string>>();

    for (const row of rows) {
        const bucket = byLabel.get(row.normalizedLabel) ?? new Set<string>();
        bucket.add(row.participantId);
        byLabel.set(row.normalizedLabel, bucket);
    }

    return new Map(
        [...byLabel.entries()]
            .filter(([, participantIds]) => participantIds.size === 1)
            .map(([label, participantIds]) => [label, [...participantIds][0] as string])
    );
}

export async function resolveParticipantIdsForSourceIdentities(
    inputs: Array<{ externalId: string; key: string; provider: string }>
) {
    const candidates = inputs
        .map((input) => ({
            externalId: input.externalId.trim(),
            key: input.key,
            provider: input.provider.trim(),
        }))
        .filter((input) => input.externalId.length > 0 && input.provider.length > 0);
    const providers = [...new Set(candidates.map((candidate) => candidate.provider))];
    const externalIds = [...new Set(candidates.map((candidate) => candidate.externalId))];

    if (providers.length === 0 || externalIds.length === 0) {
        return new Map<string, string>();
    }

    const rows = await db
        .select({
            externalId: participantsTable.externalId,
            participantId: participantsTable.id,
            provider: participantsTable.provider,
        })
        .from(participantsTable)
        .where(
            and(
                inArray(participantsTable.provider, providers),
                inArray(participantsTable.externalId, externalIds)
            )
        );
    const bySourceIdentity = new Map<string, Set<string>>();

    for (const row of rows) {
        if (!row.externalId) {
            continue;
        }

        const key = `${row.provider}:${row.externalId}`;
        const bucket = bySourceIdentity.get(key) ?? new Set<string>();
        bucket.add(row.participantId);
        bySourceIdentity.set(key, bucket);
    }

    const resolved = new Map<string, string>();

    for (const candidate of candidates) {
        const matches = bySourceIdentity.get(`${candidate.provider}:${candidate.externalId}`);

        if (matches?.size === 1) {
            resolved.set(candidate.key, [...matches][0]);
        }
    }

    return resolved;
}

export async function resolveParticipantIdsForObservedSenders(
    inputs: Array<{ key: string; provider: string; senderLabel: string }>
) {
    const candidates = inputs.map((input) => ({
        externalId: extractObservedExternalId(input.senderLabel),
        key: input.key,
        normalizedLabel: normalizeObservedParticipantLabel(input.senderLabel),
        provider: input.provider,
    }));
    const providers = [...new Set(candidates.map((candidate) => candidate.provider))];
    const externalIds = [
        ...new Set(
            candidates
                .map((candidate) => candidate.externalId)
                .filter((value): value is string => Boolean(value))
        ),
    ];
    const normalizedLabels = [
        ...new Set(
            candidates
                .map((candidate) => candidate.normalizedLabel)
                .filter((value): value is string => value.length > 0)
        ),
    ];

    if (providers.length === 0 || (externalIds.length === 0 && normalizedLabels.length === 0)) {
        return new Map<string, string>();
    }

    const conditions: NonNullable<ReturnType<typeof and>>[] = [];

    if (externalIds.length > 0) {
        const condition = and(
            inArray(participantsTable.provider, providers),
            inArray(participantsTable.externalId, externalIds)
        );

        if (condition) {
            conditions.push(condition);
        }
    }

    if (normalizedLabels.length > 0) {
        const condition = and(
            inArray(participantsTable.provider, providers),
            inArray(participantLabelsTable.normalizedLabel, normalizedLabels)
        );

        if (condition) {
            conditions.push(condition);
        }
    }

    if (conditions.length === 0) {
        return new Map<string, string>();
    }

    const rows = await db
        .select({
            externalId: participantsTable.externalId,
            normalizedLabel: participantLabelsTable.normalizedLabel,
            participantId: participantsTable.id,
            provider: participantsTable.provider,
        })
        .from(participantsTable)
        .leftJoin(
            participantLabelsTable,
            eq(participantLabelsTable.participantId, participantsTable.id)
        )
        .where(or(...conditions));

    const byExternal = new Map<string, Set<string>>();
    const byLabel = new Map<string, Set<string>>();

    for (const row of rows) {
        if (row.externalId) {
            const key = `${row.provider}:external:${row.externalId}`;
            const bucket = byExternal.get(key) ?? new Set<string>();
            bucket.add(row.participantId);
            byExternal.set(key, bucket);
        }

        if (row.normalizedLabel) {
            const key = `${row.provider}:label:${row.normalizedLabel}`;
            const bucket = byLabel.get(key) ?? new Set<string>();
            bucket.add(row.participantId);
            byLabel.set(key, bucket);
        }
    }

    const resolved = new Map<string, string>();

    for (const candidate of candidates) {
        const externalKey = candidate.externalId
            ? `${candidate.provider}:external:${candidate.externalId}`
            : null;
        const externalMatches = externalKey ? byExternal.get(externalKey) : null;

        if (externalMatches?.size === 1) {
            resolved.set(candidate.key, [...externalMatches][0]);
            continue;
        }

        const labelMatches = byLabel.get(
            `${candidate.provider}:label:${candidate.normalizedLabel}`
        );

        if (labelMatches?.size === 1) {
            resolved.set(candidate.key, [...labelMatches][0]);
        }
    }

    return resolved;
}

export async function upsertParticipants(records: ParticipantInsert[]) {
    if (records.length === 0) {
        return;
    }

    await db
        .insert(participantsTable)
        .values(records)
        .onConflictDoUpdate({
            target: participantsTable.id,
            set: {
                accountKey: sql.raw('excluded.account_key'),
                externalId: sql.raw('excluded.external_id'),
                lastSeenAt: sql.raw('excluded.last_seen_at'),
                observedName: sql.raw('excluded.observed_name'),
                provider: sql.raw('excluded.provider'),
                updatedAt: sql.raw('excluded.updated_at'),
            },
        });
}

export async function upsertParticipantLabels(records: ParticipantLabelInsert[]) {
    if (records.length === 0) {
        return;
    }

    await db
        .insert(participantLabelsTable)
        .values(records)
        .onConflictDoUpdate({
            target: participantLabelsTable.id,
            set: {
                label: sql.raw('excluded.label'),
                lastSeenAt: sql.raw('excluded.last_seen_at'),
                updatedAt: sql.raw('excluded.updated_at'),
            },
        });
}

export async function linkParticipantToProfile(input: {
    participantId: string;
    profileId: string;
}) {
    const timestamp = new Date().toISOString();

    await db
        .insert(profileParticipantsTable)
        .values({
            createdAt: timestamp,
            participantId: input.participantId,
            profileId: input.profileId,
        })
        .onConflictDoNothing();
}

function hydrateParticipants(
    rows: Array<{
        accountKey: string | null;
        externalId: string | null;
        id: string;
        label: string | null;
        lastSeenAt: string | null;
        observedName: string;
        profileAvatar: string | null;
        profileDisplayName: string | null;
        profileId: string | null;
        profilePrimaryColor: string | null;
        provider: string;
    }>
) {
    const byId = new Map<string, Participant>();

    for (const row of rows) {
        const existing = byId.get(row.id);

        if (existing) {
            if (row.label && !existing.labels.includes(row.label)) {
                existing.labels.push(row.label);
            }

            if (!existing.linkedProfile && row.profileId) {
                existing.linkedProfile = {
                    avatar: row.profileAvatar,
                    displayName: row.profileDisplayName,
                    id: row.profileId,
                    primaryColor: row.profilePrimaryColor,
                };
            }

            continue;
        }

        byId.set(row.id, {
            accountKey: row.accountKey,
            externalId: row.externalId,
            id: row.id,
            labels: row.label ? [row.label] : [],
            lastSeenAt: row.lastSeenAt,
            linkedProfile: row.profileId
                ? {
                      avatar: row.profileAvatar,
                      displayName: row.profileDisplayName,
                      id: row.profileId,
                      primaryColor: row.profilePrimaryColor,
                  }
                : null,
            observedName: row.observedName,
            provider: row.provider,
        });
    }

    return [...byId.values()].map((participant) => ({
        ...participant,
        labels: [...participant.labels].sort((left, right) => left.localeCompare(right)),
    }));
}
