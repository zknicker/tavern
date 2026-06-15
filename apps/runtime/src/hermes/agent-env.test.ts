import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const tempHermesHome = await vi.hoisted(async () => {
    const [{ mkdtempSync }, { tmpdir }, { join }] = await Promise.all([
        import('node:fs'),
        import('node:os'),
        import('node:path'),
    ]);
    const home = mkdtempSync(join(tmpdir(), 'tavern-hermes-home-'));
    process.env.TAVERN_HERMES_HOME = home;
    return home;
});

import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { handleAgentEnvRequest } from './agent-env-routes';

const envPath = path.join(tempHermesHome, '.env');

describe('agent env settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(envPath, { force: true });
    });

    test('stores env values write-only and materializes managed Hermes env', async () => {
        const response = await putAgentEnv({
            variables: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
        });
        const body = (await response?.json()) as Record<string, unknown>;

        expect(response?.status).toBe(200);
        expect(body.variables).toEqual([{ hasValue: true, name: 'GITHUB_TOKEN' }]);
        expect(JSON.stringify(body)).not.toContain('secret-token');
        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain(
            'GITHUB_TOKEN="secret-token"'
        );
    });

    test('keeps existing values when saves omit them', async () => {
        await putAgentEnv({
            variables: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
        });

        const response = await putAgentEnv({
            variables: [{ name: 'GITHUB_TOKEN' }],
        });

        expect(response?.status).toBe(200);
        await expect(fs.readFile(envPath, 'utf8')).resolves.toContain(
            'GITHUB_TOKEN="secret-token"'
        );
    });

    test('removes deleted managed names without clearing unmanaged entries', async () => {
        await fs.writeFile(envPath, 'KEEP_ME="still-here"\n');
        await putAgentEnv({
            variables: [{ name: 'GITHUB_TOKEN', value: 'secret-token' }],
        });

        const response = await putAgentEnv({ variables: [] });

        expect(response?.status).toBe(200);
        const env = await fs.readFile(envPath, 'utf8');
        expect(env).not.toContain('GITHUB_TOKEN');
        expect(env).toContain('KEEP_ME="still-here"');
    });

    test('rejects reserved env names', async () => {
        const response = await putAgentEnv({
            variables: [{ name: 'TAVERN_RUNTIME_TOKEN', value: 'nope' }],
        });

        expect(response?.status).toBe(400);
    });
});

async function putAgentEnv(body: unknown) {
    return await handleAgentEnvRequest(
        new Request('http://runtime.test/agent-env', {
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
        })
    );
}
