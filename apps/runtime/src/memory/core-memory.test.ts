import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { readAgentCoreMemoryFile, writeAgentCoreMemoryFile } from './core-memory.ts';

describe('Agent core memory files', () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-memory-core-'));
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: workspace,
            },
            syncedAt: '2026-07-02T19:00:00.000Z',
        });
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(workspace, { force: true, recursive: true });
    });

    test('reads a missing core memory file as empty and writes with the empty hash', async () => {
        const snapshot = await readAgentCoreMemoryFile({ agentId: 'agt_primary', name: 'USER.md' });
        expect(snapshot.content).toBe('');

        const change = await writeAgentCoreMemoryFile({
            agentId: 'agt_primary',
            content: '- Prefers concise updates.\n',
            expectedHash: snapshot.hash,
            name: 'USER.md',
        });
        expect(change).toMatchObject({ beforeHash: null, path: 'USER.md' });
        await expect(fs.readFile(path.join(workspace, 'USER.md'), 'utf8')).resolves.toBe(
            '- Prefers concise updates.\n'
        );
    });

    test('rejects a write when the core memory file changed since it was read', async () => {
        const snapshot = await readAgentCoreMemoryFile({
            agentId: 'agt_primary',
            name: 'MEMORY.md',
        });
        await fs.writeFile(path.join(workspace, 'MEMORY.md'), '- User-authored rule.\n');

        await expect(
            writeAgentCoreMemoryFile({
                agentId: 'agt_primary',
                content: '- Conflicting rule.\n',
                expectedHash: snapshot.hash,
                name: 'MEMORY.md',
            })
        ).rejects.toThrow('MEMORY.md changed since it was read.');
        await expect(fs.readFile(path.join(workspace, 'MEMORY.md'), 'utf8')).resolves.toBe(
            '- User-authored rule.\n'
        );
    });
});
