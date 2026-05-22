import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AgentRuntimeMacApp } from '@tavern/api';

const execFileAsync = promisify(execFile);
const recentAppLimit = 80;
const defaultAppLimit = 80;
const appIconLimit = 12;
const inventoryTtlMs = 60_000;
const appIconDataUrlCache = new Map<string, string | null>();
let cachedInventory:
    | {
          entries: LocalAppCandidate[];
          expiresAt: number;
      }
    | null = null;
let refreshPromise: Promise<LocalAppCandidate[]> | null = null;

interface LocalAppCandidate extends AgentRuntimeMacApp {
    path?: string;
}

export async function listMacApps({
    limit = defaultAppLimit,
    query = '',
}: {
    limit?: number;
    query?: string;
} = {}): Promise<AgentRuntimeMacApp[]> {
    const normalizedQuery = normalizeAppLabel(query);
    const cachedEntries = readCachedInventory();

    if (cachedEntries && !isInventoryStale()) {
        return formatAppEntries({
            entries: cachedEntries,
            limit,
            normalizedQuery,
        });
    }

    return formatAppEntries({
        entries: await refreshMacAppInventory(),
        limit,
        normalizedQuery,
    });
}

async function refreshMacAppInventory() {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = readFullMacAppInventory()
        .then((entries) => {
            cachedInventory = {
                entries,
                expiresAt: Date.now() + inventoryTtlMs,
            };
            return entries;
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
}

async function readFullMacAppInventory() {
    const [recentApps, runningApps] = await Promise.all([listRecentApps(), listRunningApps()]);

    return mergeAppEntries([...recentApps, ...runningApps]);
}

async function formatAppEntries({
    entries,
    limit,
    normalizedQuery,
}: {
    entries: LocalAppCandidate[];
    limit: number;
    normalizedQuery: string;
}) {
    const nextEntries = normalizedQuery ? filterAppEntries(entries, normalizedQuery) : entries;

    return await attachAppIcons(nextEntries.slice(0, normalizeLimit(limit)));
}

function readCachedInventory() {
    return cachedInventory?.entries ?? null;
}

function isInventoryStale() {
    return (cachedInventory?.expiresAt ?? 0) <= Date.now();
}

function normalizeLimit(limit: number) {
    return Number.isFinite(limit) && limit > 0 ? Math.min(limit, defaultAppLimit) : defaultAppLimit;
}

async function listRecentApps(): Promise<LocalAppCandidate[]> {
    const paths = await runCommand('mdfind', [
        'kMDItemContentType == "com.apple.application-bundle" && kMDItemLastUsedDate >= $time.today(-14)',
    ]);

    const appPaths = paths
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, recentAppLimit);

    const entries = await Promise.all(appPaths.map(readAppMetadata));

    return entries.filter((entry) => entry !== null);
}

async function readAppMetadata(appPath: string): Promise<LocalAppCandidate | null> {
    const output = await runCommand('mdls', [
        '-name',
        'kMDItemCFBundleIdentifier',
        '-name',
        'kMDItemDisplayName',
        '-name',
        'kMDItemLastUsedDate',
        '-name',
        'kMDItemUseCount',
        appPath,
    ]);
    const metadata = parseMdlsOutput(output);
    const label = metadata.kMDItemDisplayName ?? appPath.split('/').at(-1)?.replace(/\.app$/u, '');

    if (!label) {
        return null;
    }

    const bundleId =
        metadata.kMDItemCFBundleIdentifier ?? (await readAppPlistValue(appPath, 'CFBundleIdentifier'));

    return {
        bundleId: bundleId ?? undefined,
        label: presentAppName(label),
        lastUsedAt: metadata.kMDItemLastUsedDate,
        path: appPath,
        usageCount: metadata.kMDItemUseCount ? Number(metadata.kMDItemUseCount) : undefined,
    };
}

async function listRunningApps(): Promise<LocalAppCandidate[]> {
    const output = await runCommand('osascript', [
        '-l',
        'JavaScript',
        '-e',
        [
            'const se = Application("System Events");',
            'JSON.stringify(se.processes.whose({ backgroundOnly: false })().map((process) => ({',
            '  path: process.applicationFile().posixPath(),',
            '  bundleId: process.bundleIdentifier(),',
            '  label: process.name(),',
            '})).filter((process) => process.bundleId));',
        ].join('\n'),
    ]);

    const apps = parseRunningApps(output);

    return apps
        .filter((entry) => entry.bundleId && entry.label)
        .map((entry) => ({
            bundleId: entry.bundleId,
            label: presentAppName(entry.label ?? ''),
            path: entry.path,
            running: true,
        }));
}

function mergeAppEntries(entries: LocalAppCandidate[]): LocalAppCandidate[] {
    const byKey = new Map<string, LocalAppCandidate>();

    for (const entry of entries) {
        const keys = getAppMergeKeys(entry);
        const existing = keys.map((key) => byKey.get(key)).find(Boolean);
        const merged = mergeAppEntry(existing, entry);

        for (const key of getAppMergeKeys(merged)) {
            byKey.set(key, merged);
        }
    }

    return [...new Set(byKey.values())].sort(compareAppEntries);
}

async function attachAppIcons(entries: LocalAppCandidate[]): Promise<AgentRuntimeMacApp[]> {
    const next = await Promise.all(
        entries.map(async (entry, index) => {
            if (index >= appIconLimit || !entry.path) {
                return entry;
            }

            const iconDataUrl = await readAppIconDataUrl(entry.path);

            return iconDataUrl
                ? {
                      ...entry,
                      iconDataUrl,
                  }
                : entry;
        })
    );

    return next.map(({ path: _path, ...entry }) => entry);
}

function filterAppEntries(entries: LocalAppCandidate[], normalizedQuery: string) {
    return entries.filter((entry) =>
        normalizeAppLabel([entry.label, entry.bundleId].filter(Boolean).join(' ')).includes(
            normalizedQuery
        )
    );
}

function getAppMergeKeys(entry: LocalAppCandidate) {
    return [entry.bundleId, entry.path, normalizeAppLabel(entry.label)].filter(
        (key): key is string => Boolean(key)
    );
}

function mergeAppEntry(
    existing: LocalAppCandidate | undefined,
    next: LocalAppCandidate
): LocalAppCandidate {
    if (!existing) {
        return next;
    }

    return {
        bundleId: existing.bundleId ?? next.bundleId,
        label: existing.label || next.label,
        lastUsedAt: maxString(existing.lastUsedAt, next.lastUsedAt),
        path: existing.path ?? next.path,
        running: existing.running || next.running || undefined,
        usageCount: Math.max(existing.usageCount ?? 0, next.usageCount ?? 0) || undefined,
    };
}

function compareAppEntries(left: AgentRuntimeMacApp, right: AgentRuntimeMacApp) {
    const running = Number(right.running === true) - Number(left.running === true);

    if (running !== 0) {
        return running;
    }

    const usage = (right.usageCount ?? 0) - (left.usageCount ?? 0);

    if (usage !== 0) {
        return usage;
    }

    return (
        (right.lastUsedAt ?? '').localeCompare(left.lastUsedAt ?? '') ||
        left.label.localeCompare(right.label)
    );
}

function parseMdlsOutput(output: string) {
    const metadata: Record<string, string | undefined> = {};

    for (const line of output.split('\n')) {
        const match = /^(\w+)\s+=\s+(.+)$/u.exec(line.trim());

        if (!match) {
            continue;
        }

        const value = match[2]?.trim();

        if (!value || value === '(null)') {
            continue;
        }

        metadata[match[1] ?? ''] = value.replace(/^"|"$/gu, '');
    }

    return metadata;
}

function parseRunningApps(output: string) {
    try {
        return JSON.parse(output) as Array<{ bundleId?: string; label?: string; path?: string }>;
    } catch {
        return [];
    }
}

async function readAppIconDataUrl(appPath: string) {
    if (appIconDataUrlCache.has(appPath)) {
        return appIconDataUrlCache.get(appPath) ?? null;
    }

    const iconPath = await resolveAppIconPath(appPath);

    if (!iconPath) {
        appIconDataUrlCache.set(appPath, null);
        return null;
    }

    const dataUrl = await convertIconToDataUrl(iconPath);
    appIconDataUrlCache.set(appPath, dataUrl);

    return dataUrl;
}

async function resolveAppIconPath(appPath: string) {
    const iconName = await readAppPlistValue(appPath, 'CFBundleIconFile');

    if (!iconName) {
        return null;
    }

    return path.join(
        appPath,
        'Contents',
        'Resources',
        iconName.endsWith('.icns') ? iconName : `${iconName}.icns`
    );
}

async function readAppPlistValue(appPath: string, key: string) {
    const value = await runCommand('plutil', [
        '-extract',
        key,
        'raw',
        '-o',
        '-',
        path.join(appPath, 'Contents', 'Info.plist'),
    ]);

    return value.trim() || null;
}

async function convertIconToDataUrl(iconPath: string) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tavern-app-icon-'));
    const outputPath = path.join(tempDir, 'icon.png');

    try {
        await execFileAsync('sips', ['-Z', '64', '-s', 'format', 'png', iconPath, '--out', outputPath], {
            maxBuffer: 1024 * 1024,
            timeout: 1200,
        });
        const data = await readFile(outputPath);

        return `data:image/png;base64,${data.toString('base64')}`;
    } catch {
        return null;
    } finally {
        await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
    }
}

async function runCommand(command: string, args: string[]) {
    try {
        const { stdout } = await execFileAsync(command, args, {
            maxBuffer: 1024 * 1024,
            timeout: 1200,
        });

        return stdout;
    } catch {
        return '';
    }
}

function maxString(left: string | undefined, right: string | undefined) {
    if (!left) {
        return right;
    }

    if (!right) {
        return left;
    }

    return left > right ? left : right;
}

function presentAppName(name: string) {
    return name === 'Google Chrome' ? 'Chrome' : name;
}

function normalizeAppLabel(label: string) {
    return label.trim().toLowerCase();
}
