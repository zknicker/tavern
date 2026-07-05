import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

export type SkillUsageKind = 'injected' | 'viewed';

export interface SkillUsageSummary {
    lastUsedAt: string | null;
    useCount: number;
}

export function recordSkillUsage(input: {
    agentId: string;
    db?: Database;
    kind: SkillUsageKind;
    occurredAt?: string;
    skillId: string;
}) {
    const db = input.db ?? getDb();
    db.prepare(
        `INSERT INTO skill_usage (skill_id, agent_id, kind, occurred_at)
         VALUES ($skillId, $agentId, $kind, $occurredAt)`
    ).run(
        namedParams({
            agentId: input.agentId,
            kind: input.kind,
            occurredAt: input.occurredAt ?? new Date().toISOString(),
            skillId: input.skillId,
        })
    );
}

export function recordInjectedSkillUsage(input: {
    agentId: string;
    db?: Database;
    skillIds: string[];
}) {
    const seen = new Set<string>();
    for (const skillId of input.skillIds) {
        if (seen.has(skillId)) {
            continue;
        }
        seen.add(skillId);
        recordSkillUsage({
            agentId: input.agentId,
            db: input.db,
            kind: 'injected',
            skillId,
        });
    }
}

export function readSkillUsageSummary(skillId: string, db: Database = getDb()): SkillUsageSummary {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS use_count, MAX(occurred_at) AS last_used_at
             FROM skill_usage
             WHERE skill_id = $skillId`
        )
        .get(namedParams({ skillId })) as { last_used_at: string | null; use_count: number };

    return {
        lastUsedAt: row.last_used_at,
        useCount: row.use_count,
    };
}
