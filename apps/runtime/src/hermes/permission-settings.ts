import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimePermissionSettings,
    type AgentRuntimeSavePermissionSettings,
    agentRuntimePermissionSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSavePermissionSettingsResultSchema,
    agentRuntimeSavePermissionSettingsSchema,
} from '@tavern/api';
import { parseDocument } from 'yaml';
import * as z from 'zod';
import { HERMES_HOME } from '../config';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import { json } from '../tavern/http';
import type { HermesPermissionsDomain } from './generated-config';
import { writeManagedHermesConfigFile } from './model-config';
import { requestManagedHermesRestart } from './supervisor';

const permissionSettingsMetadataKey = 'hermes:permission-settings';

/**
 * Stored shape adds tombstones for allowlist rules the user removed, so
 * engine-persisted "always" entries still present in the generated config are
 * not re-imported, while genuinely new engine additions are.
 */
const storedPermissionSettingsSchema = agentRuntimePermissionSettingsSchema
    .omit({ updatedAt: true })
    .extend({ removedAllowlist: z.array(z.string()).default([]) });

type StoredPermissionSettings = z.infer<typeof storedPermissionSettingsSchema>;

export async function handlePermissionSettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.permissionSettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(
            agentRuntimePermissionSettingsSchema.parse(await getHermesPermissionSettings())
        );
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSavePermissionSettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        const settings = await saveHermesPermissionSettings(input);
        await writeManagedHermesConfigFile();
        const restartScheduled = requestManagedHermesRestart();

        return json(
            agentRuntimeSavePermissionSettingsResultSchema.parse({ ...settings, restartScheduled })
        );
    }

    return null;
}

/**
 * Effective permission settings. The Tavern store is the source of truth once
 * the user saves; until then the view reflects the live generated config so
 * existing installs and engine defaults read accurately. Allowlist entries the
 * engine persisted out-of-band (live "always" answers) are imported so they
 * stay visible and deletable.
 */
export async function getHermesPermissionSettings(): Promise<AgentRuntimePermissionSettings> {
    const imported = await importEngineAllowlistEntries();
    if (imported) {
        return toApiSettings(imported);
    }

    const fileValues = await readGeneratedPermissionValues();
    return {
        approvalMode: fileValues.approvalMode ?? 'ask',
        automationApprovalMode: fileValues.automationApprovalMode ?? 'deny',
        commandAllowlist: fileValues.commandAllowlist,
        updatedAt: null,
    };
}

/**
 * Resolve the generated-config permissions domain. Null when the user has
 * never saved permission settings, so the domain leaves the file untouched.
 */
export async function resolveConfiguredPermissionsDomain(): Promise<HermesPermissionsDomain | null> {
    const imported = await importEngineAllowlistEntries();
    if (!imported) {
        return null;
    }
    return {
        approvalMode: imported.settings.approvalMode,
        automationApprovalMode: imported.settings.automationApprovalMode,
        commandAllowlist: imported.settings.commandAllowlist,
    };
}

async function saveHermesPermissionSettings(
    input: AgentRuntimeSavePermissionSettings
): Promise<AgentRuntimePermissionSettings> {
    const imported = await importEngineAllowlistEntries();
    const current = imported?.settings ?? (await defaultStoredSettings());
    const nextAllowlist = input.commandAllowlist ?? current.commandAllowlist;
    // An explicit list is what the user saw and confirmed: entries it drops
    // become tombstones so the generated config cannot re-import them.
    const removed = input.commandAllowlist
        ? current.commandAllowlist.filter((entry) => !input.commandAllowlist?.includes(entry))
        : [];
    const next = {
        approvalMode: input.approvalMode ?? current.approvalMode,
        automationApprovalMode: input.automationApprovalMode ?? current.automationApprovalMode,
        commandAllowlist: nextAllowlist,
        removedAllowlist: [
            ...current.removedAllowlist.filter((entry) => !nextAllowlist.includes(entry)),
            ...removed,
        ],
    } satisfies StoredPermissionSettings;

    return toApiSettings({ settings: next, updatedAt: writeStoredSettings(next) });
}

/**
 * Import engine-persisted allowlist entries (live "always" answers) from the
 * generated config into the store. Returns null when the user has never saved
 * permission settings.
 */
async function importEngineAllowlistEntries() {
    const stored = readStoredPermissionSettings();
    if (!stored) {
        return null;
    }

    const fileValues = await readGeneratedPermissionValues();
    const additions = fileValues.commandAllowlist.filter(
        (entry) =>
            !(
                stored.settings.commandAllowlist.includes(entry) ||
                stored.settings.removedAllowlist.includes(entry)
            )
    );

    if (additions.length === 0) {
        return stored;
    }

    const next = {
        ...stored.settings,
        commandAllowlist: [...stored.settings.commandAllowlist, ...additions],
    } satisfies StoredPermissionSettings;
    return { settings: next, updatedAt: writeStoredSettings(next) };
}

function readStoredPermissionSettings() {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: permissionSettingsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return null;
    }

    const parsed = storedPermissionSettingsSchema.safeParse(JSON.parse(row.value));
    if (!parsed.success) {
        throw new Error('Stored agent permission settings are invalid; re-save them.');
    }

    return { settings: parsed.data, updatedAt: row.updated_at };
}

function writeStoredSettings(settings: StoredPermissionSettings) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                key: permissionSettingsMetadataKey,
                now,
                value: JSON.stringify(settings),
            })
        );
    return now;
}

async function defaultStoredSettings(): Promise<StoredPermissionSettings> {
    const fileValues = await readGeneratedPermissionValues();
    return {
        approvalMode: fileValues.approvalMode ?? 'ask',
        automationApprovalMode: fileValues.automationApprovalMode ?? 'deny',
        commandAllowlist: fileValues.commandAllowlist,
        removedAllowlist: [],
    };
}

async function readGeneratedPermissionValues() {
    const raw = await fs.readFile(path.join(HERMES_HOME, 'config.yaml'), 'utf8').catch(() => null);
    const config = raw
        ? (parseDocument(raw).toJS() as {
              approvals?: { cron_mode?: unknown; mode?: unknown };
              command_allowlist?: unknown;
          } | null)
        : null;

    return {
        approvalMode: toProductApprovalMode(config?.approvals?.mode),
        automationApprovalMode: toProductApprovalMode(config?.approvals?.cron_mode),
        commandAllowlist: Array.isArray(config?.command_allowlist)
            ? config.command_allowlist.filter(
                  (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
              )
            : [],
    };
}

function toProductApprovalMode(value: unknown): 'allow' | 'ask' | 'deny' | null {
    if (value === 'manual') {
        return 'ask';
    }
    return value === 'allow' || value === 'deny' ? value : null;
}

function toApiSettings(stored: {
    settings: StoredPermissionSettings;
    updatedAt: string;
}): AgentRuntimePermissionSettings {
    return {
        approvalMode: stored.settings.approvalMode,
        automationApprovalMode: stored.settings.automationApprovalMode,
        commandAllowlist: stored.settings.commandAllowlist,
        updatedAt: stored.updatedAt,
    };
}
