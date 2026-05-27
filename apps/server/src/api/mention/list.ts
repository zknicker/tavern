import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    recordCapabilityFailure,
    recordCapabilityStatus,
    recordCapabilitySuccess,
} from '../../agent-runtime/capability-status.ts';
import { getAgentRuntimeConnection } from '../../agent-runtime-connection/service.ts';
import { publicProcedure } from '../trpc.ts';
import {
    type ComputerUseAppInventory,
    getComputerUsePluginUri,
    listComputerUseApps,
} from './computer-use-apps.ts';
import {
    listMentionInventoryInputSchema,
    listMentionInventoryOutputSchema,
    listMentionOptionsInputSchema,
    listMentionOptionsOutputSchema,
    listMentionPathOptionsInputSchema,
    type MentionOptionResult,
} from './contracts.ts';
import { listRuntimeSkillMentionOptions, type RuntimeSkillList } from './skill-options.ts';
import { listWorkspacePathMentionOptions } from './workspace-options.ts';

const codexBundledPluginRoot = path.join(
    os.homedir(),
    '.codex',
    'plugins',
    'cache',
    'openai-bundled'
);
const codexBundledMarketplace = 'openai-bundled';
const computerUseCapabilityMethod = 'computer-use.list-apps';
const mentionCapabilityMethod = 'mention.list';
const mentionCapabilitySuccessTtlMs = 30_000;
let nextMentionCapabilitySuccessRecordAt = 0;
let nextComputerUseCapabilityRecordAt = 0;

export const listMentionOptionsProcedure = publicProcedure
    .input(listMentionOptionsInputSchema)
    .output(listMentionOptionsOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionOptionsInputSchema.parse(input);
        const query = parsed?.query ?? '';
        const limit = parsed?.limit ?? 12;
        try {
            const computerUseAppInventory = await listComputerUseApps({ query });
            const options = await buildMentionOptions({
                agentId: parsed?.agentId,
                computerUseAppInventory,
                limit,
                query,
            });

            await recordComputerUseCapability(computerUseAppInventory);
            await recordMentionCapabilitySuccess();

            return { options, query };
        } catch (error) {
            await recordMentionCapabilityFailure(error);
            throw error;
        }
    });

export const listMentionInventoryProcedure = publicProcedure
    .input(listMentionInventoryInputSchema)
    .output(listMentionInventoryOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionInventoryInputSchema.parse(input);
        const limit = parsed?.limit ?? 120;

        try {
            const computerUseAppInventory = await listComputerUseApps();
            const options = await buildMentionInventory({
                agentId: parsed?.agentId,
                computerUseAppInventory,
                limit,
            });

            await recordComputerUseCapability(computerUseAppInventory);
            await recordMentionCapabilitySuccess();

            return { options };
        } catch (error) {
            await recordMentionCapabilityFailure(error);
            throw error;
        }
    });

export const listMentionPathOptionsProcedure = publicProcedure
    .input(listMentionPathOptionsInputSchema)
    .output(listMentionOptionsOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionPathOptionsInputSchema.parse(input);

        try {
            const options = await listWorkspacePathMentionOptions({
                agentId: parsed.agentId,
                limit: parsed.limit,
                query: parsed.query,
            });

            await recordMentionCapabilitySuccess();

            return { options, query: parsed.query };
        } catch (error) {
            await recordMentionCapabilityFailure(error);
            throw error;
        }
    });

export async function buildMentionOptions({
    agentId,
    codexPluginRoot: pluginRoot = readSinglePathOverride(
        process.env.TAVERN_MENTION_CODEX_PLUGIN_ROOT,
        codexBundledPluginRoot
    ),
    computerUseAppInventory,
    limit,
    query,
    runtimeSkills,
    workspaceFolder,
}: {
    agentId?: string;
    codexPluginRoot?: string;
    computerUseAppInventory?: ComputerUseAppInventory;
    limit: number;
    query: string;
    runtimeSkills?: RuntimeSkillList;
    workspaceFolder?: string;
}) {
    const [skills, plugins, apps, paths] = await Promise.all([
        listRuntimeSkillMentionOptions({ agentId, runtimeSkills }),
        listCodexPluginOptions(pluginRoot),
        listComputerUseAppMentionOptions(computerUseAppInventory),
        listWorkspacePathMentionOptions({ agentId, query, workspaceFolder }),
    ]);
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return listDefaultMentionOptions({ apps, limit, plugins, skills });
    }

    return [...skills, ...plugins, ...apps, ...paths]
        .filter((option) => matchesMentionQuery(option, normalizedQuery))
        .slice(0, limit);
}

export async function buildMentionInventory({
    agentId,
    codexPluginRoot: pluginRoot = readSinglePathOverride(
        process.env.TAVERN_MENTION_CODEX_PLUGIN_ROOT,
        codexBundledPluginRoot
    ),
    computerUseAppInventory,
    limit,
    runtimeSkills,
}: {
    agentId?: string;
    codexPluginRoot?: string;
    computerUseAppInventory?: ComputerUseAppInventory;
    limit: number;
    runtimeSkills?: RuntimeSkillList;
}) {
    const [skills, plugins, apps] = await Promise.all([
        listRuntimeSkillMentionOptions({ agentId, runtimeSkills }),
        listCodexPluginOptions(pluginRoot),
        listComputerUseAppMentionOptions(computerUseAppInventory),
    ]);

    return [...apps, ...skills, ...plugins].slice(0, limit);
}

function listDefaultMentionOptions({
    apps,
    limit,
    plugins,
    skills,
}: {
    apps: MentionOptionResult[];
    limit: number;
    plugins: MentionOptionResult[];
    skills: MentionOptionResult[];
}) {
    const sourceSlices = {
        apps: apps.filter((option) => matchesMentionQuery(option, '')),
        plugins: plugins.filter((option) => matchesMentionQuery(option, '')),
        skills: skills.filter((option) => matchesMentionQuery(option, '')),
    };
    const options: MentionOptionResult[] = [];
    const usedKeys = new Set<string>();

    appendMentionOptions(options, usedKeys, sourceSlices.apps, Math.min(1, limit));

    const reservedPluginCount = sourceSlices.plugins.length > 0 && options.length < limit ? 1 : 0;
    appendMentionOptions(
        options,
        usedKeys,
        sourceSlices.skills,
        limit - options.length - reservedPluginCount
    );
    appendMentionOptions(options, usedKeys, sourceSlices.plugins, limit - options.length);

    if (options.length < limit) {
        appendMentionOptions(options, usedKeys, sourceSlices.apps, limit - options.length);
    }

    return options;
}

function appendMentionOptions(
    options: MentionOptionResult[],
    usedKeys: Set<string>,
    source: MentionOptionResult[],
    count: number
) {
    let remaining = count;

    if (remaining <= 0) {
        return;
    }

    for (const option of source) {
        if (usedKeys.has(getMentionOptionKey(option))) {
            continue;
        }

        options.push(option);
        usedKeys.add(getMentionOptionKey(option));

        remaining -= 1;

        if (remaining === 0) {
            break;
        }
    }
}

function getMentionOptionKey(option: MentionOptionResult) {
    return `${option.kind}:${option.id}:${option.label}`;
}

async function listCodexPluginOptions(pluginRoot: string): Promise<MentionOptionResult[]> {
    const pluginDirs = await readDirectory(pluginRoot);
    const options = await Promise.all(
        pluginDirs
            .filter((entry) => entry.isDirectory())
            .map(async (pluginEntry) => {
                const versions = await readDirectory(path.join(pluginRoot, pluginEntry.name));
                return await Promise.all(
                    versions
                        .filter((entry) => entry.isDirectory())
                        .map((versionEntry) =>
                            readCodexPluginOption(
                                codexBundledMarketplace,
                                path.join(pluginRoot, pluginEntry.name, versionEntry.name)
                            )
                        )
                );
            })
    );

    const flattened: Array<MentionOptionResult | null> = options.flat(2);

    return flattened
        .filter((option): option is MentionOptionResult => option !== null)
        .sort((left, right) => left.label.localeCompare(right.label));
}

async function readCodexPluginOption(marketplace: string, pluginDir: string) {
    const manifestPath = path.join(pluginDir, '.codex-plugin', 'plugin.json');
    const manifest = await readJsonRecord(manifestPath);

    if (!manifest) {
        return null;
    }

    const name = readString(manifest.name);

    if (!name) {
        return null;
    }

    const pluginInterface = readRecord(manifest.interface);
    const label = readString(pluginInterface?.displayName) ?? titleizeName(name);

    return {
        description:
            readString(pluginInterface?.shortDescription) ?? readString(manifest.description),
        id: `plugin://${name}@${marketplace}`,
        insertText: label,
        kind: 'plugin',
        label,
        projection: 'capability-reference',
        sourceLabel: 'Plugin',
    } satisfies MentionOptionResult;
}

async function listComputerUseAppMentionOptions(
    inventoryOverride: ComputerUseAppInventory | undefined
): Promise<MentionOptionResult[]> {
    const inventory = inventoryOverride ?? (await listComputerUseApps());

    return inventory.entries
        .map(
            (entry) =>
                ({
                    description: 'Computer Use',
                    id: getComputerUsePluginUri(),
                    insertText: entry.label,
                    kind: 'app',
                    label: entry.label,
                    metadata: {
                        ...(entry.bundleId ? { bundleId: entry.bundleId } : {}),
                        ...(entry.iconDataUrl ? { iconDataUrl: entry.iconDataUrl } : {}),
                        source: inventory.source,
                        ...(entry.lastUsedAt ? { lastUsedAt: entry.lastUsedAt } : {}),
                        ...(entry.running !== undefined ? { running: entry.running } : {}),
                        ...(entry.usageCount !== undefined ? { usageCount: entry.usageCount } : {}),
                    },
                    projection: 'capability-reference',
                    sourceLabel: 'Mac app',
                }) satisfies MentionOptionResult
        )
        .sort((left, right) => {
            const leftRunning = left.metadata?.running === true ? 0 : 1;
            const rightRunning = right.metadata?.running === true ? 0 : 1;

            return leftRunning - rightRunning || left.label.localeCompare(right.label);
        });
}

function matchesMentionQuery(option: MentionOptionResult, normalizedQuery: string) {
    if (!normalizedQuery) {
        return option.kind === 'skill' || option.kind === 'plugin' || option.kind === 'app';
    }

    return normalizeQuery(
        [option.label, option.insertText, option.id, option.description, option.sourceLabel]
            .filter(Boolean)
            .join(' ')
    ).includes(normalizedQuery);
}

async function readDirectory(directory: string) {
    try {
        return await fs.readdir(directory, { withFileTypes: true });
    } catch {
        return [];
    }
}

async function readJsonRecord(filePath: string) {
    try {
        return readRecord(JSON.parse(await fs.readFile(filePath, 'utf8')));
    } catch {
        return null;
    }
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeQuery(value: string) {
    return value.trim().toLowerCase();
}

function readSinglePathOverride(value: string | undefined, fallback: string) {
    return value && value.trim().length > 0 ? value : fallback;
}

function titleizeName(name: string) {
    return name
        .replace(/[_-]+/g, ' ')
        .split(/\s+/u)
        .filter(Boolean)
        .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
        .join(' ');
}

async function recordMentionCapabilitySuccess() {
    const now = Date.now();

    if (now < nextMentionCapabilitySuccessRecordAt) {
        return;
    }

    const connection = await getAgentRuntimeConnection();

    if (!connection) {
        return;
    }

    await recordCapabilitySuccess({
        capability: 'mentions',
        method: mentionCapabilityMethod,
        runtimeId: connection.id,
    });
    nextMentionCapabilitySuccessRecordAt = now + mentionCapabilitySuccessTtlMs;
}

async function recordMentionCapabilityFailure(error: unknown) {
    const connection = await getAgentRuntimeConnection();

    if (!connection) {
        return;
    }

    await recordCapabilityFailure({
        capability: 'mentions',
        error,
        method: mentionCapabilityMethod,
        runtimeId: connection.id,
    });
}

async function recordComputerUseCapability(inventory: ComputerUseAppInventory) {
    const now = Date.now();

    if (now < nextComputerUseCapabilityRecordAt) {
        return;
    }

    const connection = await getAgentRuntimeConnection();

    if (!connection) {
        return;
    }

    nextComputerUseCapabilityRecordAt = now + mentionCapabilitySuccessTtlMs;

    if (inventory.status === 'ready') {
        await recordCapabilitySuccess({
            capability: 'computerUse',
            method: computerUseCapabilityMethod,
            runtimeId: connection.id,
        });
        return;
    }

    await recordCapabilityStatus({
        capability: 'computerUse',
        errorCode: 'computer_use_app_inventory_unavailable',
        metadataJson: JSON.stringify({
            entries: inventory.entries.length,
            source: inventory.source,
        }),
        method: computerUseCapabilityMethod,
        reason: 'Computer Use app inventory is unavailable.',
        runtimeId: connection.id,
        state: 'unavailable',
        technicalMessage: `Computer Use app inventory source: ${inventory.source}.`,
    });
}
