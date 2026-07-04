import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { formatAppReferenceTarget } from '@tavern/api/rich-references';
import { publicProcedure } from '../trpc.ts';
import {
    type ComputerUseAppInventory,
    type ComputerUseAppInventoryEntry,
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

export const listMentionOptionsProcedure = publicProcedure
    .input(listMentionOptionsInputSchema)
    .output(listMentionOptionsOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionOptionsInputSchema.parse(input);
        const query = parsed?.query ?? '';
        const limit = parsed?.limit ?? 12;
        const computerUseAppInventory = await listComputerUseApps({ query });
        const options = await buildMentionOptions({
            agentId: parsed?.agentId,
            computerUseAppInventory,
            limit,
            query,
        });

        return { options, query };
    });

export const listMentionInventoryProcedure = publicProcedure
    .input(listMentionInventoryInputSchema)
    .output(listMentionInventoryOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionInventoryInputSchema.parse(input);
        const limit = parsed?.limit ?? 120;
        const agentIds = normalizeMentionAgentIds({
            agentId: parsed?.agentId,
            agentIds: parsed?.agentIds,
        });

        const computerUseAppInventory = await listComputerUseApps();
        const options = await buildMentionInventory({
            agentIds,
            computerUseAppInventory,
            limit,
        });

        return { options };
    });

export const listMentionPathOptionsProcedure = publicProcedure
    .input(listMentionPathOptionsInputSchema)
    .output(listMentionOptionsOutputSchema)
    .query(async ({ input }) => {
        const parsed = listMentionPathOptionsInputSchema.parse(input);

        const options = await listWorkspacePathMentionOptions({
            agentId: parsed.agentId,
            limit: parsed.limit,
            query: parsed.query,
        });

        return { options, query: parsed.query };
    });

export async function buildMentionOptions({
    agentId,
    agentIds,
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
    agentIds?: readonly string[];
    codexPluginRoot?: string;
    computerUseAppInventory?: ComputerUseAppInventory;
    limit: number;
    query: string;
    runtimeSkills?: RuntimeSkillList;
    workspaceFolder?: string;
}) {
    const [skills, plugins, apps, paths] = await Promise.all([
        listRuntimeSkillMentionOptions({
            agentIds: normalizeMentionAgentIds({ agentId, agentIds }),
            runtimeSkills,
        }),
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
    agentIds,
    codexPluginRoot: pluginRoot = readSinglePathOverride(
        process.env.TAVERN_MENTION_CODEX_PLUGIN_ROOT,
        codexBundledPluginRoot
    ),
    computerUseAppInventory,
    limit,
    runtimeSkills,
}: {
    agentId?: string;
    agentIds?: readonly string[];
    codexPluginRoot?: string;
    computerUseAppInventory?: ComputerUseAppInventory;
    limit: number;
    runtimeSkills?: RuntimeSkillList;
}) {
    const [skills, plugins, apps] = await Promise.all([
        listRuntimeSkillMentionOptions({
            agentIds: normalizeMentionAgentIds({ agentId, agentIds }),
            runtimeSkills,
        }),
        listCodexPluginOptions(pluginRoot),
        listComputerUseAppMentionOptions(computerUseAppInventory),
    ]);

    // Plugins are a small bounded set; reserve room for them so large app and
    // skill inventories cannot crowd them out of the limit entirely.
    const reserved = [...apps, ...skills].slice(0, Math.max(0, limit - plugins.length));
    return [...reserved, ...plugins].slice(0, limit);
}

function normalizeMentionAgentIds(input: { agentId?: string; agentIds?: readonly string[] }) {
    const ids = input.agentIds ?? (input.agentId ? [input.agentId] : []);

    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
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
        .filter((entry): entry is ComputerUseAppInventoryEntry & { bundleId: string } =>
            Boolean(entry.bundleId)
        )
        .map(
            (entry) =>
                ({
                    description: 'Computer Use',
                    id: formatAppReferenceTarget(entry.bundleId),
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
