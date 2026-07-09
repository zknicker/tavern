import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { handleTavernRuntimeRequest } from '../tavern/router.ts';

describe('task dispatch settings routes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'Primary',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_primary',
            },
        });
    });

    afterEach(() => closeDb());

    test('defaults global controls off and persists updates', async () => {
        const initial = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/tasks/dispatch-settings')
        );
        expect(await initial.json()).toMatchObject({
            autoDispatchConcurrency: 1,
            autoDispatchEnabled: false,
        });

        const saved = await handleTavernRuntimeRequest(
            jsonRequest('/tasks/dispatch-settings', {
                autoDispatchConcurrency: 3,
                autoDispatchEnabled: true,
            })
        );
        expect(await saved.json()).toMatchObject({
            autoDispatchConcurrency: 3,
            autoDispatchEnabled: true,
        });
    });

    test('updates per-agent dispatch and review controls', async () => {
        const response = await handleTavernRuntimeRequest(
            jsonRequest(
                '/agents/agt_primary/task-settings',
                {
                    autoDispatchEnabled: true,
                    taskReviewPolicy: true,
                },
                'PATCH'
            )
        );
        expect(await response.json()).toMatchObject({
            autoDispatchEnabled: true,
            id: 'agt_primary',
            taskReviewPolicy: true,
        });
    });
});

function jsonRequest(path: string, body: unknown, method = 'PUT') {
    return new Request(`http://runtime.test${path}`, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    });
}
