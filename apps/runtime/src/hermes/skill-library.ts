import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
    AgentRuntimeSkillHubAvailable,
    AgentRuntimeSkillHubInstalledEntry,
    AgentRuntimeSkillHubItem,
} from '@tavern/api';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { engineInstallDir, resolveHermesPin } from './engine';
import { readSkillFrontmatterDescription } from './skill-frontmatter';
import { listTapSkillListings, type TapSearchOptions } from './skill-tap-search';
import type { SkillTapsOptions } from './skill-taps';

/**
 * The available-skills view behind the Sources tab: the engine's built-in
 * library (the vendored `optional-skills/` directory, official skills that are
 * not activated by default), the user's tap repos, and the install lockfile
 * that marks which of them are already installed. All three are local reads —
 * no engine HTTP and no centralized index.
 */

export interface SkillLibraryOptions extends SkillTapsOptions, TapSearchOptions {
    engineSourceDir?: string;
}

export async function getAvailableSkills(
    options?: SkillLibraryOptions
): Promise<AgentRuntimeSkillHubAvailable> {
    const [builtin, taps, installed] = await Promise.all([
        listBuiltinLibrarySkills(options).catch(() => []),
        listTapSkillListings(options).catch(() => []),
        readInstalledHubSkills(options).catch(() => ({})),
    ]);
    return { builtin, installed, taps };
}

export async function listBuiltinLibrarySkills(
    options?: SkillLibraryOptions
): Promise<AgentRuntimeSkillHubItem[]> {
    const libraryDir = await resolveBuiltinLibraryDir(options);
    if (!libraryDir) {
        return [];
    }

    const skillDirs = await findSkillDirs(libraryDir, libraryDir, 0);
    const items = await Promise.all(
        skillDirs.sort().map(async (skillDir): Promise<AgentRuntimeSkillHubItem> => {
            const skillMd = await fs
                .readFile(path.join(skillDir, 'SKILL.md'), 'utf8')
                .catch(() => '');
            return {
                description: readSkillFrontmatterDescription(skillMd),
                identifier: `official/${path.relative(libraryDir, skillDir).split(path.sep).join('/')}`,
                name: path.basename(skillDir),
                repo: null,
                source: 'official',
                tags: [],
                trustLevel: 'builtin',
            };
        })
    );
    return items;
}

export async function readInstalledHubSkills(
    options?: SkillTapsOptions
): Promise<Record<string, AgentRuntimeSkillHubInstalledEntry>> {
    const home = options?.home ?? HERMES_HOME;
    const raw = await fs
        .readFile(path.join(home, 'skills', '.hub', 'lock.json'), 'utf8')
        .catch(() => null);
    if (raw === null) {
        return {};
    }
    const parsed: unknown = JSON.parse(raw);
    const entries =
        typeof parsed === 'object' && parsed !== null
            ? ((parsed as { installed?: unknown }).installed ?? {})
            : {};
    if (typeof entries !== 'object' || entries === null) {
        return {};
    }

    const installed: Record<string, AgentRuntimeSkillHubInstalledEntry> = {};
    for (const [name, entry] of Object.entries(entries)) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const record = entry as Record<string, unknown>;
        const identifier = typeof record.identifier === 'string' ? record.identifier : null;
        if (!identifier) {
            continue;
        }
        installed[identifier] = {
            name,
            scanVerdict: typeof record.scan_verdict === 'string' ? record.scan_verdict : null,
            trustLevel: typeof record.trust_level === 'string' ? record.trust_level : null,
        };
    }
    return installed;
}

/**
 * The built-in library ships inside the engine source checkout, so resolve it
 * the same way the engine binary resolves: explicit configured install, then
 * the managed pin, then the system install location.
 */
async function resolveBuiltinLibraryDir(options?: SkillLibraryOptions): Promise<null | string> {
    if (options?.engineSourceDir !== undefined) {
        const candidate = path.join(options.engineSourceDir, 'optional-skills');
        return (await isDirectory(candidate)) ? candidate : null;
    }

    const candidates: string[] = [];
    const configuredBin = readConfigValue('TAVERN_HERMES_BIN');
    if (configuredBin) {
        // A configured binary is usually <root>/venv/bin/hermes.
        const binPath = resolveConfiguredPath(configuredBin);
        candidates.push(path.dirname(path.dirname(path.dirname(binPath))));
    }
    candidates.push(engineInstallDir(resolveHermesPin()));
    candidates.push(path.join(process.env.HOME || os.homedir(), '.hermes', 'hermes-agent'));

    for (const root of candidates) {
        const candidate = path.join(root, 'optional-skills');
        if (await isDirectory(candidate)) {
            return candidate;
        }
    }
    return null;
}

async function findSkillDirs(dir: string, root: string, depth: number): Promise<string[]> {
    if (depth > 3) {
        return [];
    }
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
        return dir === root ? [] : [dir];
    }
    const nested = await Promise.all(
        entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    !entry.name.startsWith('.') &&
                    entry.name !== '__pycache__'
            )
            .map((entry) => findSkillDirs(path.join(dir, entry.name), root, depth + 1))
    );
    return nested.flat();
}

async function isDirectory(target: string) {
    const stat = await fs.stat(target).catch(() => null);
    return stat?.isDirectory() === true;
}
