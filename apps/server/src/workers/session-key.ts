import { and, eq, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { cronRunsTable } from '../db/schema/cron.ts';

interface ParsedCronRunId {
    jobId: string;
    runAt: string;
}

function parseCronRunId(runId: string): ParsedCronRunId | null {
    const match = /^cron:(.+):(\d+)$/.exec(runId.trim());

    if (!match) {
        return null;
    }

    const [, jobId, runAtMs] = match;
    const runAtTimestamp = Number(runAtMs);

    if (!Number.isFinite(runAtTimestamp)) {
        return null;
    }

    return {
        jobId,
        runAt: new Date(runAtTimestamp).toISOString(),
    };
}

export async function listWorkerSessionKeysByRunId(runIds: Array<string | null>) {
    const parsedRunIds = [...new Set(runIds)]
        .flatMap((runId) => (typeof runId === 'string' ? [parseCronRunId(runId)] : []))
        .filter((value): value is ParsedCronRunId => value !== null);

    if (parsedRunIds.length === 0) {
        return new Map<string, string>();
    }

    const [firstPair, ...remainingPairs] = parsedRunIds;
    const whereClause = or(
        and(
            or(
                eq(cronRunsTable.jobId, firstPair.jobId),
                eq(cronRunsTable.providerJobId, firstPair.jobId)
            ),
            eq(cronRunsTable.runAt, firstPair.runAt)
        ),
        ...remainingPairs.map((pair) =>
            and(
                or(
                    eq(cronRunsTable.jobId, pair.jobId),
                    eq(cronRunsTable.providerJobId, pair.jobId)
                ),
                eq(cronRunsTable.runAt, pair.runAt)
            )
        )
    );

    if (!whereClause) {
        return new Map<string, string>();
    }

    const rows = await db
        .select({
            jobId: cronRunsTable.jobId,
            providerJobId: cronRunsTable.providerJobId,
            runAt: cronRunsTable.runAt,
            sessionKey: cronRunsTable.sessionKey,
        })
        .from(cronRunsTable)
        .where(whereClause);

    return new Map(
        rows.flatMap((row) => {
            const keys = [`${row.jobId}:${row.runAt}`];

            if (row.providerJobId) {
                keys.push(`${row.providerJobId}:${row.runAt}`);
            }

            return keys.map((key) => [key, row.sessionKey] as const);
        })
    );
}
