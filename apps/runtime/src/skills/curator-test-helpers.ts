import { getDb } from '../db/connection.ts';
import { skillCuratorMetadataKey } from './curator.ts';

export function configureDeepCuratorModel() {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)`
        )
        .run({
            $key: 'models:category-settings',
            $now: '2026-07-01T00:00:00.000Z',
            $value: JSON.stringify({
                categories: {
                    deep: {
                        baseUrl: 'http://127.0.0.1:1/v1',
                        model: 'curator-test',
                        provider: 'openai-compatible',
                    },
                    fast: null,
                    standard: null,
                    visual: null,
                },
            }),
        });
}

export function readCurationJobs() {
    return getDb()
        .prepare("SELECT * FROM memory_jobs WHERE kind = 'curation' ORDER BY created_at ASC")
        .all() as Array<{
        agent_id: string;
        file_changes_json: string;
        kind: string;
        metadata_json: string;
        model_category: string;
        status: string;
    }>;
}

export function setSkillState(skillId: string, state: string) {
    getDb()
        .prepare('UPDATE skill_sources SET state = $state WHERE skill_id = $skillId')
        .run({ $skillId: skillId, $state: state });
}

export function writeLastCurationAt(value: string) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $value)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run({ $key: skillCuratorMetadataKey, $value: value });
}

export function clearLastCurationAt() {
    getDb()
        .prepare('DELETE FROM runtime_metadata WHERE key = $key')
        .run({ $key: skillCuratorMetadataKey });
}
