import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { handleTavernRuntimeRequest } from './router.ts';

describe('agent web settings route', () => {
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

    test('defaults off and persists updates', async () => {
        const initial = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_primary/config')
        );
        expect(await initial.json()).toMatchObject({
            id: 'agt_primary',
            webAccessEnabled: false,
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_primary/web-settings', {
                body: JSON.stringify({ webAccessEnabled: true }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(await response.json()).toMatchObject({
            id: 'agt_primary',
            webAccessEnabled: true,
        });
    });
});
