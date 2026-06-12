import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentRuntimeSkillHubItem, AgentRuntimeSkillHubTap } from '@tavern/api';
import { listSkillHubTaps, type SkillTapsOptions } from './skill-taps';

/**
 * Tap skills searched by Runtime itself.
 *
 * The engine's fast search path serves results from its centralized index and
 * skips the live GitHub source entirely, which makes user taps — including
 * private repos — invisible. Tap repos are small and user-owned, so Runtime
 * lists them directly through the GitHub contents API and merges the results
 * into hub search and the catalog.
 */

export interface TapSearchOptions extends SkillTapsOptions {
    apiBaseUrl?: string;
    cacheTtlMs?: number;
    token?: string | null;
}

const defaultCacheTtlMs = 5 * 60 * 1000;
const maxSkillsPerTap = 50;
const tapCache = new Map<string, { fetchedAt: number; items: AgentRuntimeSkillHubItem[] }>();

export async function listTapSkills(
    options?: TapSearchOptions
): Promise<AgentRuntimeSkillHubItem[]> {
    const { taps } = await listSkillHubTaps(options);
    const lists = await Promise.all(
        taps.map((tap) => listTapRepoSkills(tap, options).catch(() => []))
    );
    return lists.flat();
}

export async function searchTapSkills(
    query: string,
    options?: TapSearchOptions
): Promise<AgentRuntimeSkillHubItem[]> {
    const normalized = query.trim().toLowerCase();
    const items = await listTapSkills(options);
    if (normalized.length === 0) {
        return items;
    }
    return items.filter((item) =>
        `${item.name} ${item.description}`.toLowerCase().includes(normalized)
    );
}

export function clearTapSkillCache() {
    tapCache.clear();
}

async function listTapRepoSkills(tap: AgentRuntimeSkillHubTap, options?: TapSearchOptions) {
    const cacheKey = `${tap.repo}:${tap.path}`;
    const cached = tapCache.get(cacheKey);
    const ttl = options?.cacheTtlMs ?? defaultCacheTtlMs;
    if (cached && Date.now() - cached.fetchedAt < ttl) {
        return cached.items;
    }

    const token = options?.token === undefined ? await resolveGitHubToken() : options.token;
    const apiBaseUrl = options?.apiBaseUrl ?? 'https://api.github.com';
    const basePath = tap.path.replace(/^\/+|\/+$/gu, '');
    const entries = await fetchGitHubJson(
        `${apiBaseUrl}/repos/${tap.repo}/contents/${basePath}`,
        token
    );
    const skillDirs = (Array.isArray(entries) ? entries : [])
        .filter(
            (entry): entry is { name: string; type: string } =>
                typeof entry === 'object' &&
                entry !== null &&
                (entry as { type?: unknown }).type === 'dir' &&
                typeof (entry as { name?: unknown }).name === 'string'
        )
        .slice(0, maxSkillsPerTap);

    const items = await Promise.all(
        skillDirs.map(async (dir): Promise<AgentRuntimeSkillHubItem | null> => {
            const skillMd = await fetchGitHubRaw(
                `${apiBaseUrl}/repos/${tap.repo}/contents/${basePath}/${dir.name}/SKILL.md`,
                token
            ).catch(() => null);
            if (skillMd === null) {
                return null;
            }
            return {
                description: readFrontmatterDescription(skillMd),
                identifier: `${tap.repo}/${basePath}/${dir.name}`,
                name: dir.name,
                repo: tap.repo,
                source: 'github',
                tags: [],
                trustLevel: 'community',
            };
        })
    );

    const resolved = items.filter((item): item is AgentRuntimeSkillHubItem => item !== null);
    tapCache.set(cacheKey, { fetchedAt: Date.now(), items: resolved });
    return resolved;
}

async function fetchGitHubJson(url: string, token: null | string): Promise<unknown> {
    const response = await fetch(url, { headers: gitHubHeaders(token) });
    if (!response.ok) {
        throw new Error(`GitHub request failed with ${response.status}.`);
    }
    return await response.json();
}

async function fetchGitHubRaw(url: string, token: null | string): Promise<string> {
    const response = await fetch(url, {
        headers: { ...gitHubHeaders(token), accept: 'application/vnd.github.raw+json' },
    });
    if (!response.ok) {
        throw new Error(`GitHub request failed with ${response.status}.`);
    }
    return await response.text();
}

function gitHubHeaders(token: null | string): Record<string, string> {
    return {
        accept: 'application/vnd.github+json',
        'user-agent': 'tavern-runtime',
        ...(token ? { authorization: `token ${token}` } : {}),
    };
}

const execFileAsync = promisify(execFile);
let cachedToken: { value: null | string } | null = null;

async function resolveGitHubToken(): Promise<null | string> {
    if (cachedToken) {
        return cachedToken.value;
    }
    const fromEnv = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
    if (fromEnv) {
        cachedToken = { value: fromEnv };
        return fromEnv;
    }
    try {
        const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 5000 });
        const token = stdout.trim();
        cachedToken = { value: token.length > 0 ? token : null };
    } catch {
        cachedToken = { value: null };
    }
    return cachedToken.value;
}

function readFrontmatterDescription(skillMd: string): string {
    const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/u)?.[1];
    const description = frontmatter?.match(/^description:\s*(.+)$/mu)?.[1];
    return description?.trim().replace(/^['"]|['"]$/gu, '') ?? '';
}
