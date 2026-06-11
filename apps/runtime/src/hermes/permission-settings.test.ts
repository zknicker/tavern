import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { parseDocument } from 'yaml';

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
import {
    getHermesPermissionSettings,
    handlePermissionSettingsRequest,
} from './permission-settings';

const configPath = path.join(tempHermesHome, 'config.yaml');

describe('agent permission settings', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(configPath, { force: true });
    });

    test('defaults to safe modes and an empty allowlist when unconfigured', async () => {
        await expect(getHermesPermissionSettings()).resolves.toEqual({
            approvalMode: 'ask',
            automationApprovalMode: 'deny',
            commandAllowlist: [],
            updatedAt: null,
        });
        await expect(fs.stat(configPath)).rejects.toThrow();
    });

    test('unconfigured view reflects the live generated config', async () => {
        await fs.writeFile(
            configPath,
            [
                'approvals:',
                '  mode: allow',
                '  cron_mode: manual',
                'command_allowlist:',
                '  - engine-entry',
                '',
            ].join('\n')
        );

        await expect(getHermesPermissionSettings()).resolves.toEqual({
            approvalMode: 'allow',
            automationApprovalMode: 'ask',
            commandAllowlist: ['engine-entry'],
            updatedAt: null,
        });
    });

    test('PUT persists settings and writes engine approval modes', async () => {
        const response = await putSettings({
            approvalMode: 'ask',
            automationApprovalMode: 'allow',
            commandAllowlist: ['rm -rf /tmp/scratch'],
        });
        const body = (await response?.json()) as Record<string, unknown>;

        expect(response?.status).toBe(200);
        expect(body.restartScheduled).toBe(false);
        expect(body.approvalMode).toBe('ask');

        const config = await readGeneratedConfig();
        expect(config.approvals).toEqual({ cron_mode: 'allow', mode: 'manual' });
        expect(config.command_allowlist).toEqual(['rm -rf /tmp/scratch']);
    });

    test('imports engine-persisted always entries into the visible allowlist', async () => {
        await putSettings({ approvalMode: 'ask' });
        await appendEngineAllowlistEntry('engine-always-entry');

        const settings = await getHermesPermissionSettings();
        expect(settings.commandAllowlist).toContain('engine-always-entry');
    });

    test('removing a rule restores prompting and is not re-imported', async () => {
        await putSettings({ approvalMode: 'ask' });
        await appendEngineAllowlistEntry('engine-always-entry');
        await getHermesPermissionSettings();

        await putSettings({ commandAllowlist: [] });
        expect((await readGeneratedConfig()).command_allowlist).toBeUndefined();

        // Simulate a stale generated config still carrying the removed entry:
        // the tombstone must keep it from coming back.
        await appendEngineAllowlistEntry('engine-always-entry');
        const settings = await getHermesPermissionSettings();
        expect(settings.commandAllowlist).not.toContain('engine-always-entry');
    });

    test('re-adding a removed rule clears its tombstone', async () => {
        await putSettings({ commandAllowlist: ['pattern-a'] });
        await putSettings({ commandAllowlist: [] });
        await putSettings({ commandAllowlist: ['pattern-a'] });

        const settings = await getHermesPermissionSettings();
        expect(settings.commandAllowlist).toEqual(['pattern-a']);
        expect((await readGeneratedConfig()).command_allowlist).toEqual(['pattern-a']);
    });

    test('partial updates keep unrelated fields', async () => {
        await putSettings({
            approvalMode: 'allow',
            commandAllowlist: ['pattern-a'],
        });
        await putSettings({ automationApprovalMode: 'ask' });

        await expect(getHermesPermissionSettings()).resolves.toMatchObject({
            approvalMode: 'allow',
            automationApprovalMode: 'ask',
            commandAllowlist: ['pattern-a'],
        });
    });

    test('ignores requests for other routes', async () => {
        await expect(
            handlePermissionSettingsRequest(new Request('http://runtime.test/health'))
        ).resolves.toBeNull();
    });
});

async function putSettings(body: unknown) {
    return await handlePermissionSettingsRequest(
        new Request('http://runtime.test/permission-settings', {
            body: JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
        })
    );
}

async function readGeneratedConfig() {
    return parseDocument(await fs.readFile(configPath, 'utf8')).toJS() as {
        approvals?: { cron_mode?: string; mode?: string };
        command_allowlist?: string[];
    };
}

/** Simulate the engine persisting a live "always" answer into the config. */
async function appendEngineAllowlistEntry(entry: string) {
    const doc = parseDocument((await fs.readFile(configPath, 'utf8').catch(() => '')) || '{}');
    const current = (doc.toJS() as { command_allowlist?: string[] } | null)?.command_allowlist;
    doc.setIn(['command_allowlist'], [...(current ?? []), entry]);
    await fs.writeFile(configPath, doc.toString());
}
