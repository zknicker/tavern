import { asc, desc } from 'drizzle-orm';
import { type LogEntry, logEntrySchema } from '../agents/contracts.ts';
import { db } from '../db/index.ts';
import { type LogInsert, logsTable } from '../db/schema.ts';

function parseLogTags(tagsJson: string) {
    const parsed = JSON.parse(tagsJson) as unknown;
    return logEntrySchema.shape.tags.parse(parsed);
}

function mapLogRecord(record: typeof logsTable.$inferSelect): LogEntry {
    return logEntrySchema.parse({
        id: record.id,
        level: record.level,
        message: record.message,
        source: record.source,
        tags: parseLogTags(record.tagsJson),
        time: record.time,
    });
}

export async function listLogs() {
    const records = await db
        .select()
        .from(logsTable)
        .orderBy(desc(logsTable.time), asc(logsTable.id));

    return records.map(mapLogRecord);
}

export async function replaceLogs(records: LogInsert[]) {
    await db.transaction(async (tx) => {
        await tx.delete(logsTable);

        if (records.length > 0) {
            await tx.insert(logsTable).values(records);
        }
    });
}
