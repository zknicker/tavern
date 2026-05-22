import { beforeEach, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-capability-status-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const [{ ensureDatabaseSchema }, { databaseClient }, capabilityStorage] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('./agent-runtime-capability-status.ts'),
]);

ensureDatabaseSchema();

beforeEach(() => {
    databaseClient.exec('delete from agent_runtime_capability_status');
});

test('saveAgentRuntimeCapabilityStatus preserves last healthy timestamp across failures', async () => {
    await capabilityStorage.saveAgentRuntimeCapabilityStatus({
        capability: 'skills',
        checkedAt: '2026-05-04T12:00:00.000Z',
        method: 'skills.status',
        runtimeId: 'openclaw-main',
        state: 'healthy',
    });

    await capabilityStorage.saveAgentRuntimeCapabilityStatus({
        capability: 'skills',
        checkedAt: '2026-05-04T12:05:00.000Z',
        errorCode: 'unauthorized',
        method: 'skills.status',
        reason: 'Tavern is not authorized to use this runtime capability.',
        runtimeId: 'openclaw-main',
        state: 'unauthorized',
        technicalMessage: 'Unauthorized',
    });

    const status = await capabilityStorage.getAgentRuntimeCapabilityStatus({
        capability: 'skills',
        runtimeId: 'openclaw-main',
    });

    expect(status).toMatchObject({
        capability: 'skills',
        checkedAt: '2026-05-04T12:05:00.000Z',
        errorCode: 'unauthorized',
        lastHealthyAt: '2026-05-04T12:00:00.000Z',
        method: 'skills.status',
        runtimeId: 'openclaw-main',
        state: 'unauthorized',
    });
});

test('listAgentRuntimeCapabilityStatuses scopes rows by runtime', async () => {
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'models',
        runtimeId: 'openclaw-main',
    });
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'models',
        runtimeId: 'other-runtime',
    });
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'skills',
        runtimeId: 'openclaw-main',
    });

    const statuses = await capabilityStorage.listAgentRuntimeCapabilityStatuses('openclaw-main');

    expect(statuses.map((status) => status.capability)).toEqual(['models', 'skills']);
});

test('listAgentRuntimeCapabilityStatuses accepts runtime-owned capability rows', async () => {
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'computerUse',
        method: 'computer-use.list-apps',
        runtimeId: 'openclaw-main',
    });
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'memory',
        method: 'memory.status',
        runtimeId: 'openclaw-main',
    });
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'mentions',
        method: 'mention.list',
        runtimeId: 'openclaw-main',
    });
    await capabilityStorage.markAgentRuntimeCapabilityHealthy({
        capability: 'skillMaterialization',
        method: 'local-openclaw-workspace-probe',
        runtimeId: 'openclaw-main',
    });

    const statuses = await capabilityStorage.listAgentRuntimeCapabilityStatuses('openclaw-main');

    expect(statuses).toMatchObject([
        {
            capability: 'computerUse',
            method: 'computer-use.list-apps',
            runtimeId: 'openclaw-main',
            state: 'healthy',
        },
        {
            capability: 'memory',
            method: 'memory.status',
            runtimeId: 'openclaw-main',
            state: 'healthy',
        },
        {
            capability: 'mentions',
            method: 'mention.list',
            runtimeId: 'openclaw-main',
            state: 'healthy',
        },
        {
            capability: 'skillMaterialization',
            method: 'local-openclaw-workspace-probe',
            runtimeId: 'openclaw-main',
            state: 'healthy',
        },
    ]);
});
