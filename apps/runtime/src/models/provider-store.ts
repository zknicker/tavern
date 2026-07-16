import type {
    AgentRuntimeModelProviderCatalog,
    AgentRuntimeModelProviderCatalogEntry,
    AgentRuntimeModelProviderEnabled,
    AgentRuntimeModelProviderSetupAction,
} from '@tavern/api';
import {
    agentRuntimeModelProviderCatalogEntrySchema,
    agentRuntimeModelProviderCatalogSchema,
    agentRuntimeModelProviderEnabledSchema,
} from '@tavern/api';
import { isCliCommandAvailable } from '../agent-engine/cli-command.ts';
import { readConfigValue } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { loadClaudeSettings } from '../model-access/claude-settings.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import {
    type ModelCatalogProviderSpec,
    modelCatalogProviderSpecs,
    readAnthropicApiKey,
} from './provider-registry.ts';

interface RuntimeModelProviderRow {
    enabled: 0 | 1;
    provider_id: string;
}

export async function listModelProviderCatalog(
    db: Database = getDb()
): Promise<AgentRuntimeModelProviderCatalog> {
    const enabled = readEnabledProviderIds(db);
    const providers = await Promise.all(
        modelCatalogProviderSpecs().map(async (spec) =>
            providerCatalogEntry(spec, enabled.has(spec.provider.id))
        )
    );

    return agentRuntimeModelProviderCatalogSchema.parse({
        providers: providers.sort(
            (left, right) =>
                left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        ),
        updatedAt: new Date().toISOString(),
    });
}

export async function listEnabledModelProviders(
    db: Database = getDb()
): Promise<AgentRuntimeModelProviderEnabled> {
    const catalog = await listModelProviderCatalog(db);
    return agentRuntimeModelProviderEnabledSchema.parse({
        providers: catalog.providers.filter((provider) => provider.enabled),
        updatedAt: catalog.updatedAt,
    });
}

export async function setModelProviderEnabled(input: {
    db?: Database;
    enabled: boolean;
    providerId: string;
}): Promise<AgentRuntimeModelProviderCatalogEntry> {
    const db = input.db ?? getDb();
    const spec = modelCatalogProviderSpecs().find(
        (candidate) => candidate.provider.id === input.providerId
    );
    if (!spec) {
        throw new Error(`Unknown model provider "${input.providerId}".`);
    }

    if (input.enabled) {
        enableModelProvider(input.providerId, db);
    } else {
        disableModelProvider(input.providerId, db);
    }

    return providerCatalogEntry(spec, input.enabled);
}

export async function seedDetectedModelProviders(db: Database = getDb()): Promise<string[]> {
    const seeded: string[] = [];
    const enabled = readEnabledProviderIds(db);

    for (const spec of modelCatalogProviderSpecs()) {
        if (enabled.has(spec.provider.id)) {
            continue;
        }
        const access = await providerAccess(spec);
        if (access.state !== 'live') {
            continue;
        }
        enableModelProvider(spec.provider.id, db);
        seeded.push(spec.provider.id);
    }

    return seeded.sort();
}

export function readEnabledProviderIds(db: Database = getDb()): Set<string> {
    const rows = db
        .prepare(
            `SELECT provider_id, enabled
             FROM runtime_model_providers
             WHERE enabled = 1`
        )
        .all() as RuntimeModelProviderRow[];

    return new Set(rows.map((row) => row.provider_id));
}

function enableModelProvider(providerId: string, db: Database) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO runtime_model_providers (provider_id, enabled, created_at, updated_at)
         VALUES ($providerId, 1, $now, $now)
         ON CONFLICT(provider_id) DO UPDATE SET
           enabled = 1,
           updated_at = excluded.updated_at`
    ).run(namedParams({ now, providerId }));
}

function disableModelProvider(providerId: string, db: Database) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO runtime_model_providers (provider_id, enabled, created_at, updated_at)
         VALUES ($providerId, 0, $now, $now)
         ON CONFLICT(provider_id) DO UPDATE SET
           enabled = 0,
           updated_at = excluded.updated_at`
    ).run(namedParams({ now, providerId }));
}

async function providerCatalogEntry(
    spec: ModelCatalogProviderSpec,
    enabled: boolean
): Promise<AgentRuntimeModelProviderCatalogEntry> {
    const access = await providerAccess(spec);
    return agentRuntimeModelProviderCatalogEntrySchema.parse({
        accessDescription: access.description,
        accessState: access.state,
        authType: spec.authType,
        enabled,
        id: spec.provider.id,
        keyEnv: spec.keyEnv,
        label: spec.provider.label,
        oauthFlow: spec.oauthFlow,
        setupAction: setupAction(spec),
        setupCommand: setupCommand(spec),
    });
}

async function providerAccess(spec: ModelCatalogProviderSpec): Promise<{
    description: string;
    state: AgentRuntimeModelProviderCatalogEntry['accessState'];
}> {
    if (spec.provider.id === 'openai') {
        const apiKey =
            readConfigValue('OPENAI_API_KEY') ??
            readConfigValue('TAVERN_AGENT_API_KEY') ??
            getOpenAiApiKey();
        return apiKey
            ? { description: 'OpenAI API key is configured.', state: 'live' }
            : { description: 'Add an OpenAI API key.', state: 'needs-auth' };
    }

    if (spec.provider.id === 'codex') {
        const command = readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex';
        if (!isCliCommandAvailable(command)) {
            return { description: `Run ${command} on the Runtime host.`, state: 'unavailable' };
        }
        const credentials = await loadVaultBackedCodexCredentials();
        return credentials
            ? { description: 'Codex OAuth is configured.', state: 'live' }
            : { description: `Run ${command} login on the Runtime host.`, state: 'needs-auth' };
    }

    if (spec.provider.id === 'claude') {
        const settings = loadClaudeSettings();
        if (settings) {
            return {
                description: settings.accountEmail
                    ? `Signed in as ${settings.accountEmail}.`
                    : 'Claude sign-in is configured.',
                state: 'live',
            };
        }
        return { description: 'Sign in with Claude.', state: 'needs-auth' };
    }

    if (spec.provider.id === 'anthropic') {
        return readAnthropicApiKey()
            ? { description: 'Anthropic API key is configured.', state: 'live' }
            : { description: 'Add an Anthropic API key.', state: 'needs-auth' };
    }

    return spec.authenticated()
        ? { description: `${spec.provider.label} is configured.`, state: 'live' }
        : { description: `${spec.provider.label} needs setup.`, state: 'needs-auth' };
}

function setupAction(spec: ModelCatalogProviderSpec): AgentRuntimeModelProviderSetupAction {
    if (spec.authType === 'api_key' && spec.keyEnv) {
        return 'api-key';
    }
    if (spec.oauthFlow === 'external') {
        return 'external';
    }
    if (spec.oauthFlow) {
        return 'oauth';
    }
    return 'manual';
}

function setupCommand(spec: ModelCatalogProviderSpec): string | null {
    if (spec.provider.id === 'codex') {
        return `${readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex'} login`;
    }
    return null;
}
