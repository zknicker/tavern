import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../config/env.ts';
import * as schemaTables from './schema.ts';

const {
    agentProfilesTable,
    agentsTable,
    agentThoughtSnapshotsTable,
    apiUsageEventsTable,
    apiUsageHourlyTable,
    cachedDocumentsTable,
    claudeCodeUsageTable,
    codexUsageTable,
    cronJobsTable,
    cronRunsTable,
    jobExecutionsTable,
    logsTable,
    messagingBindingsTable,
    hermesConfigSnapshotsTable,
    skillsTable,
    sessionAccessEventsTable,
    sessionArtifactsTable,
    sessionDeliveriesTable,
    sessionLinksTable,
    sessionMessagePartsTable,
    sessionMessagesTable,
    sessionRunsTable,
    sessionToolCallsTable,
    openRouterUsageTable,
    agentRuntimeConnectionsTable,
    participantLabelsTable,
    participantsTable,
    profileParticipantsTable,
    profilesTable,
    syncStateTable,
    telemetryIngestCursorsTable,
} = schemaTables;

const databasePath = resolve(env.DATABASE_PATH);

mkdirSync(dirname(databasePath), { recursive: true });

const client = new Database(databasePath);

const schema = {
    agentProfilesTable,
    agentsTable,
    agentThoughtSnapshotsTable,
    cachedDocumentsTable,
    apiUsageEventsTable,
    apiUsageHourlyTable,
    claudeCodeUsageTable,
    codexUsageTable,
    cronJobsTable,
    cronRunsTable,
    jobExecutionsTable,
    logsTable,
    sessionAccessEventsTable,
    sessionArtifactsTable,
    sessionDeliveriesTable,
    sessionLinksTable,
    sessionMessagePartsTable,
    sessionMessagesTable,
    sessionRunsTable,
    sessionToolCallsTable,
    participantLabelsTable,
    participantsTable,
    profileParticipantsTable,
    profilesTable,
    syncStateTable,
    openRouterUsageTable,
    messagingBindingsTable,
    hermesConfigSnapshotsTable,
    skillsTable,
    agentRuntimeConnectionsTable,
    telemetryIngestCursorsTable,
};

export const db = drizzle(client, { schema });
export { client as databaseClient };
