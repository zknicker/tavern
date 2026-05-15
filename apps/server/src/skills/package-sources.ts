import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
    checkoutGitHubRepository,
    downloadToFile,
    extractZipArchive,
    prepareSkillPackage,
} from './package-files.ts';
import { findSkillPackageBySource, saveSkillPackage } from './storage.ts';

const defaultClawHubUrl = 'https://clawhub.ai';

export interface InstallSkillPackageInput {
    source: 'clawhub' | 'github';
    spec: string;
    version?: string | null;
}

export async function installSkillPackage(input: InstallSkillPackageInput) {
    if (input.source === 'github') {
        return await installGitHubSkillPackage(input);
    }
    return await installClawHubSkillPackage(input);
}

async function installClawHubSkillPackage(input: InstallSkillPackageInput) {
    const slug = normalizeClawHubSlug(input.spec);
    const detail = await fetchClawHubSkillDetail(slug);
    const resolvedVersion = input.version?.trim() || detail.latestVersion?.version || null;
    if (!resolvedVersion) {
        throw new Error(`ClawHub skill "${slug}" has no installable version.`);
    }

    const existing = await findSkillPackageBySource({
        resolvedVersion,
        sourceSpec: slug,
        sourceType: 'clawhub',
    });
    if (existing) {
        return existing;
    }

    const packageId = randomUUID();
    const archiveUrl = new URL('/api/v1/download', defaultClawHubUrl);
    archiveUrl.searchParams.set('slug', slug);
    archiveUrl.searchParams.set('version', resolvedVersion);

    const archive = await downloadToFile({
        fileName: `${slug}.zip`,
        url: archiveUrl,
    });
    try {
        const extracted = await extractZipArchive(archive.filePath);
        try {
            const prepared = await prepareSkillPackage({
                packageId,
                sourceDir: extracted.directory,
                sourceMetadata: {
                    clawhub: {
                        detail,
                        slug,
                        version: resolvedVersion,
                    },
                },
            });
            return await savePreparedPackage({
                installSource: {
                    source: 'clawhub',
                    spec: slug,
                    version: resolvedVersion,
                },
                packageId,
                prepared,
                resolvedVersion,
                sourceSpec: slug,
                sourceType: 'clawhub',
                sourceVersion: input.version ?? null,
            });
        } finally {
            await extracted.cleanup();
        }
    } finally {
        await archive.cleanup();
    }
}

async function installGitHubSkillPackage(input: InstallSkillPackageInput) {
    const parsed = parseGitHubSkillSpec(input.spec, input.version ?? null);
    const checkout = await checkoutGitHubRepository({
        ref: parsed.ref,
        repoUrl: parsed.repoUrl,
    });
    try {
        const sourceDir = parsed.skillPath
            ? path.join(checkout.directory, parsed.skillPath)
            : checkout.directory;
        const sourceSpec = formatGitHubSourceSpec({
            owner: parsed.owner,
            repo: parsed.repo,
            skillPath: parsed.skillPath,
        });
        const resolvedVersion = checkout.commit;
        const existing = await findSkillPackageBySource({
            resolvedVersion,
            sourceSpec,
            sourceType: 'github',
        });
        if (existing) {
            return existing;
        }

        const packageId = randomUUID();
        const prepared = await prepareSkillPackage({
            packageId,
            sourceDir,
            sourceMetadata: {
                github: {
                    commit: checkout.commit,
                    owner: parsed.owner,
                    ref: parsed.ref,
                    repo: parsed.repo,
                    skillPath: parsed.skillPath,
                },
            },
        });

        return await savePreparedPackage({
            installSource: {
                ref: parsed.ref,
                source: 'github',
                spec: sourceSpec,
            },
            packageId,
            prepared,
            resolvedVersion,
            sourceSpec,
            sourceType: 'github',
            sourceVersion: parsed.ref,
        });
    } finally {
        await checkout.cleanup();
    }
}

async function savePreparedPackage(input: {
    installSource: Record<string, unknown>;
    packageId: string;
    prepared: Awaited<ReturnType<typeof prepareSkillPackage>>;
    resolvedVersion: string | null;
    sourceSpec: string;
    sourceType: string;
    sourceVersion: string | null;
}) {
    const saved = await saveSkillPackage({
        allowedTools: input.prepared.allowedTools,
        cachePath: input.prepared.cachePath,
        contentHash: input.prepared.contentHash,
        description: input.prepared.description,
        displayName: input.prepared.displayName,
        filesJson: JSON.stringify(input.prepared.files),
        id: input.packageId,
        installSourceJson: JSON.stringify(input.installSource),
        metadataJson: JSON.stringify(input.prepared.metadata),
        resolvedVersion: input.resolvedVersion,
        skillName: input.prepared.skillName,
        sourceSpec: input.sourceSpec,
        sourceType: input.sourceType,
        sourceVersion: input.sourceVersion,
    });

    if (!saved) {
        throw new Error('Failed to save skill package.');
    }

    return saved;
}

async function fetchClawHubSkillDetail(slug: string) {
    const url = new URL(`/api/v1/skills/${encodeURIComponent(slug)}`, defaultClawHubUrl);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`ClawHub skill "${slug}" was not found.`);
    }
    return (await response.json()) as {
        latestVersion?: { version?: string | null } | null;
        skill?: { displayName?: string; slug?: string; summary?: string } | null;
    };
}

export function normalizeClawHubSlug(value: string) {
    const slug = value.trim().replace(/^clawhub:/iu, '');
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(slug)) {
        throw new Error(
            `Invalid ClawHub skill slug: ${value}. Use a single ClawHub slug, or switch to GitHub for owner/repo paths.`
        );
    }
    return slug;
}

function parseGitHubSkillSpec(spec: string, explicitRef: string | null) {
    const normalized = spec.trim().replace(/^https?:\/\/github\.com\//iu, '');
    const [pathSpec, hashRef] = normalized.split('#', 2);
    const parts = (pathSpec ?? '')
        .replace(/\.git$/iu, '')
        .split('/')
        .filter(Boolean);
    if (parts.length < 2) {
        throw new Error('GitHub skills need an owner/repo path.');
    }

    const [owner, repo, ...rawRest] = parts;
    if (!(owner && repo)) {
        throw new Error('GitHub skills need an owner/repo path.');
    }
    const treeIndex = rawRest.indexOf('tree');
    const rest = treeIndex === 0 && rawRest.length >= 2 ? rawRest.slice(2) : rawRest;
    const refFromTree = treeIndex === 0 ? rawRest[1] : null;

    return {
        owner,
        ref: explicitRef?.trim() || hashRef?.trim() || refFromTree || null,
        repo,
        repoUrl: `https://github.com/${owner}/${repo}.git`,
        skillPath: rest.join('/') || null,
    };
}

function formatGitHubSourceSpec(input: { owner: string; repo: string; skillPath: string | null }) {
    return [input.owner, input.repo, input.skillPath].filter(Boolean).join('/');
}
