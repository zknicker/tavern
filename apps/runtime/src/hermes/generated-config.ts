import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { merchbaseToolsetPluginName } from './merchbase-toolset-plugin.ts';
import { tavernMessengerPluginName } from './tavern-messenger-plugin.ts';

/**
 * Domain-based composer for the generated managed Hermes config file.
 *
 * Tavern Runtime storage is the source of truth; the YAML is always derived.
 * Each domain owns a fixed set of keys and only ever sets or deletes those
 * keys, so operator-managed keys elsewhere in the file survive every merge.
 */

interface HermesModelRef {
    baseUrl?: string;
    model: string;
    provider: string;
}

export interface HermesExecutionDomain {
    /** null = engine defaults; the compression keys are left untouched. */
    compression: {
        enabled: boolean;
        protectLastMessages: number;
        thresholdPercent: number;
    } | null;
    fallbackModels: HermesModelRef[];
    subagentEffort: null | string;
    subagentModel: HermesModelRef | null;
    timezone: string | null;
    /** null = engine default; web_extract summaries use the primary chat model. */
    webExtractSummarizer: (HermesModelRef & { timeoutSeconds: number }) | null;
}

export interface HermesPermissionsDomain {
    approvalMode: 'allow' | 'ask' | 'deny';
    automationApprovalMode: 'allow' | 'ask' | 'deny';
    commandAllowlist: string[];
}

export interface McpServerEntry {
    args?: string[];
    command?: string;
    env?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
    url?: string;
}

export interface HermesConnectorsDomain {
    servers: Record<string, McpServerEntry>;
    /** Previously Tavern-managed server ids to remove from the file. */
    staleIds: string[];
}

export interface HermesGeneratedConfigDomains {
    connectors: HermesConnectorsDomain;
    execution: HermesExecutionDomain;
    /** null = never configured in Tavern; the domain leaves the file untouched. */
    permissions: HermesPermissionsDomain | null;
}

export const managedHermesContextFileMaxChars = 64_000;
const staleManagedHermesPluginNames = new Set(['tavern-merchbase']);

export async function mergeHermesGeneratedConfig(
    filePath: string,
    domains: HermesGeneratedConfigDomains
) {
    const existing = await fs.readFile(filePath, 'utf8').catch(() => '');
    const doc = parseDocument(existing || '{}');

    applyExecutionDomain(doc, domains.execution);
    applyContextFilesDomain(doc);
    applyConnectorsDomain(doc, domains.connectors);
    if (domains.permissions) {
        applyPermissionsDomain(doc, domains.permissions);
    }
    applyDisplayDomain(doc);
    applyMemoryDomain(doc);
    applyCronDomain(doc);
    applyPluginsDomain(doc, [tavernMessengerPluginName(), merchbaseToolsetPluginName()]);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, doc.toString(), { mode: 0o600 });
    await fs.chmod(filePath, 0o600).catch(() => undefined);
}

type GeneratedConfigDocument = ReturnType<typeof parseDocument>;

function applyExecutionDomain(doc: GeneratedConfigDocument, execution: HermesExecutionDomain) {
    if (execution.fallbackModels.length > 0) {
        doc.setIn(
            ['fallback_providers'],
            execution.fallbackModels.map((entry) => ({
                ...(entry.baseUrl ? { base_url: entry.baseUrl } : {}),
                model: entry.model,
                provider: entry.provider,
            }))
        );
    } else {
        doc.deleteIn(['fallback_providers']);
    }

    if (execution.timezone) {
        doc.setIn(['timezone'], execution.timezone);
    } else {
        doc.deleteIn(['timezone']);
    }

    if (execution.subagentModel) {
        doc.setIn(['delegation', 'model'], execution.subagentModel.model);
        doc.setIn(['delegation', 'provider'], execution.subagentModel.provider);
        if (execution.subagentModel.baseUrl) {
            doc.setIn(['delegation', 'base_url'], execution.subagentModel.baseUrl);
        } else {
            deleteIfPresent(doc, ['delegation', 'base_url']);
        }
    } else {
        deleteIfPresent(doc, ['delegation', 'model']);
        deleteIfPresent(doc, ['delegation', 'provider']);
        deleteIfPresent(doc, ['delegation', 'base_url']);
    }

    if (execution.subagentEffort) {
        doc.setIn(['delegation', 'reasoning_effort'], execution.subagentEffort);
    } else {
        deleteIfPresent(doc, ['delegation', 'reasoning_effort']);
    }

    if (execution.compression) {
        doc.setIn(['compression', 'enabled'], execution.compression.enabled);
        doc.setIn(['compression', 'threshold'], execution.compression.thresholdPercent / 100);
        doc.setIn(['compression', 'protect_last_n'], execution.compression.protectLastMessages);
    } else {
        deleteIfPresent(doc, ['compression', 'enabled']);
        deleteIfPresent(doc, ['compression', 'threshold']);
        deleteIfPresent(doc, ['compression', 'protect_last_n']);
    }

    if (execution.webExtractSummarizer) {
        doc.setIn(
            ['auxiliary', 'web_extract', 'provider'],
            execution.webExtractSummarizer.provider
        );
        doc.setIn(['auxiliary', 'web_extract', 'model'], execution.webExtractSummarizer.model);
        doc.setIn(
            ['auxiliary', 'web_extract', 'timeout'],
            execution.webExtractSummarizer.timeoutSeconds
        );
        if (execution.webExtractSummarizer.baseUrl) {
            doc.setIn(
                ['auxiliary', 'web_extract', 'base_url'],
                execution.webExtractSummarizer.baseUrl
            );
        } else {
            deleteIfPresent(doc, ['auxiliary', 'web_extract', 'base_url']);
        }
    } else {
        deleteIfPresent(doc, ['auxiliary', 'web_extract', 'provider']);
        deleteIfPresent(doc, ['auxiliary', 'web_extract', 'model']);
        deleteIfPresent(doc, ['auxiliary', 'web_extract', 'timeout']);
        deleteIfPresent(doc, ['auxiliary', 'web_extract', 'base_url']);
        deleteEmptyMap(doc, ['auxiliary', 'web_extract']);
        deleteEmptyMap(doc, ['auxiliary']);
    }
}

function applyContextFilesDomain(doc: GeneratedConfigDocument) {
    doc.setIn(['context_file_max_chars'], managedHermesContextFileMaxChars);
}

/** deleteIn throws when an ancestor node is absent; guard nested deletes. */
function deleteIfPresent(doc: GeneratedConfigDocument, path: string[]) {
    if (doc.hasIn(path)) {
        doc.deleteIn(path);
    }
}

function deleteEmptyMap(doc: GeneratedConfigDocument, path: string[]) {
    const value = doc.getIn(path);
    const node = value && typeof value === 'object' ? (value as { items?: unknown[] }) : null;
    if (node && Array.isArray(node.items) && node.items.length === 0) {
        doc.deleteIn(path);
    }
}

/**
 * Tavern connectors own only their own entries under `mcp_servers`:
 * operator-added servers under other keys are preserved.
 */
function applyConnectorsDomain(doc: GeneratedConfigDocument, connectors: HermesConnectorsDomain) {
    for (const staleId of connectors.staleIds) {
        doc.deleteIn(['mcp_servers', staleId]);
    }
    for (const [id, entry] of Object.entries(connectors.servers)) {
        doc.setIn(['mcp_servers', id], entry);
    }

    const remaining = (doc.toJS() as { mcp_servers?: Record<string, unknown> } | null)?.mcp_servers;
    if (remaining && Object.keys(remaining).length === 0) {
        doc.deleteIn(['mcp_servers']);
    }
}

/** Product mode "ask" maps to the engine's "manual". */
function toEngineApprovalMode(mode: 'allow' | 'ask' | 'deny') {
    return mode === 'ask' ? 'manual' : mode;
}

function applyPermissionsDomain(
    doc: GeneratedConfigDocument,
    permissions: HermesPermissionsDomain
) {
    doc.setIn(['approvals', 'mode'], toEngineApprovalMode(permissions.approvalMode));
    doc.setIn(['approvals', 'cron_mode'], toEngineApprovalMode(permissions.automationApprovalMode));
    if (permissions.commandAllowlist.length > 0) {
        doc.setIn(['command_allowlist'], permissions.commandAllowlist);
    } else {
        doc.deleteIn(['command_allowlist']);
    }
}

function applyMemoryDomain(doc: GeneratedConfigDocument) {
    doc.setIn(['memory', 'memory_enabled'], true);
    doc.setIn(['memory', 'user_profile_enabled'], true);
    doc.setIn(['memory', 'provider'], '');
    doc.deleteIn(['memory', 'mnemosyne']);
}

function applyDisplayDomain(doc: GeneratedConfigDocument) {
    doc.setIn(['display', 'tool_progress'], 'all');
    doc.setIn(['display', 'interim_assistant_messages'], true);
}

function applyCronDomain(doc: GeneratedConfigDocument) {
    doc.setIn(['cron', 'wrap_response'], false);
}

function applyPluginsDomain(doc: GeneratedConfigDocument, pluginNames: string[]) {
    const enabled = (doc.toJS() as { plugins?: { enabled?: unknown } } | null)?.plugins?.enabled;
    const values = Array.isArray(enabled)
        ? enabled.filter((item): item is string => typeof item === 'string')
        : [];

    const next = values.filter((item) => !staleManagedHermesPluginNames.has(item));
    for (const pluginName of pluginNames) {
        if (!next.includes(pluginName)) {
            next.push(pluginName);
        }
    }

    doc.setIn(['plugins', 'enabled'], next);
}
