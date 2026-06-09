import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams, optionalRow } from '../db/sqlite';

export interface HermesSessionMapping {
    createdAt: string;
    hermesSessionKey: string;
    tavernSessionKey: string;
    updatedAt: string;
}

interface HermesSessionMappingRow {
    created_at: string;
    hermes_session_key: string;
    tavern_session_key: string;
    updated_at: string;
}

export async function getHermesSessionMapping(tavernSessionKey: string, db: Database = getDb()) {
    const row = optionalRow(
        db
            .prepare(
                `SELECT tavern_session_key, hermes_session_key, created_at, updated_at
                 FROM hermes_session_mappings
                 WHERE tavern_session_key = $tavernSessionKey`
            )
            .get(namedParams({ tavernSessionKey })) as HermesSessionMappingRow | null
    );

    return row ? rowToMapping(row) : null;
}

export async function saveHermesSessionMapping(
    mapping: Pick<HermesSessionMapping, 'hermesSessionKey' | 'tavernSessionKey'>,
    db: Database = getDb()
) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO hermes_session_mappings
         (tavern_session_key, hermes_session_key, created_at, updated_at)
         VALUES ($tavernSessionKey, $hermesSessionKey, $now, $now)
         ON CONFLICT(tavern_session_key) DO UPDATE SET
           hermes_session_key = excluded.hermes_session_key,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            hermesSessionKey: mapping.hermesSessionKey,
            now,
            tavernSessionKey: mapping.tavernSessionKey,
        })
    );
}

export async function deleteHermesSessionMapping(tavernSessionKey: string, db: Database = getDb()) {
    db.prepare(
        `DELETE FROM hermes_session_mappings
         WHERE tavern_session_key = $tavernSessionKey`
    ).run(namedParams({ tavernSessionKey }));
}

function rowToMapping(row: HermesSessionMappingRow): HermesSessionMapping {
    return {
        createdAt: row.created_at,
        hermesSessionKey: row.hermes_session_key,
        tavernSessionKey: row.tavern_session_key,
        updatedAt: row.updated_at,
    };
}
