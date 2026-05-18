import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AgentRuntimeSkillFile } from '@tavern/api';
import { env } from '../config/env.ts';
import { parseSkillMarkdown } from './markdown.ts';

const execFileAsync = promisify(execFile);
const skillFileCandidates = ['SKILL.md', 'skill.md', 'skills.md', 'SKILL.MD'];

export interface PreparedSkillPackage {
    allowedTools: string | null;
    cachePath: string;
    contentHash: string;
    description: string | null;
    displayName: string;
    files: AgentRuntimeSkillFile[];
    metadata: Record<string, unknown>;
    skillName: string;
}

export async function prepareSkillPackage(input: {
    packageId: string;
    sourceDir: string;
    sourceMetadata: Record<string, unknown>;
}): Promise<PreparedSkillPackage> {
    const root = await resolveSkillRoot(input.sourceDir);
    await validateSkillPackageTree(root);
    const skillFile = await readSkillFile(root);
    const parsed = parseSkillMarkdown({
        contentMarkdown: skillFile.content,
        skillId: input.packageId,
    });
    const contentHash = await hashDirectory(root);
    const cachePath = path.join(env.TAVERN_SKILLS_ROOT, 'packages', input.packageId);

    await fs.rm(cachePath, { force: true, recursive: true });
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await copyDirectory(root, cachePath);

    return {
        allowedTools: parsed.allowedTools,
        cachePath,
        contentHash,
        description: parsed.description,
        displayName: parsed.name,
        files: await listSkillFiles(cachePath),
        metadata: {
            ...input.sourceMetadata,
            frontmatter: parsed.metadata ?? null,
        },
        skillName: parsed.name,
    };
}

export async function downloadToFile(input: { fileName: string; url: URL }) {
    const response = await fetch(input.url);
    if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}.`);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-download-'));
    const filePath = path.join(tempDir, input.fileName);
    await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));

    return {
        filePath,
        cleanup: async () => {
            await fs.rm(tempDir, { force: true, recursive: true });
        },
    };
}

export async function extractZipArchive(archivePath: string) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-extract-'));
    await execFileAsync('unzip', ['-q', archivePath, '-d', tempDir]);
    return {
        directory: tempDir,
        cleanup: async () => {
            await fs.rm(tempDir, { force: true, recursive: true });
        },
    };
}

export async function checkoutGitHubRepository(input: { ref: string | null; repoUrl: string }) {
    const checkoutDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-github-'));
    await runGit(['init'], checkoutDir);
    await runGit(['remote', 'add', 'origin', input.repoUrl], checkoutDir);
    await runGit(['fetch', '--depth', '1', 'origin', input.ref ?? 'HEAD'], checkoutDir);
    await runGit(['checkout', '--detach', 'FETCH_HEAD'], checkoutDir);
    const commit = (await runGit(['rev-parse', 'HEAD'], checkoutDir)).trim();

    return {
        commit,
        directory: checkoutDir,
        cleanup: async () => {
            await fs.rm(checkoutDir, { force: true, recursive: true });
        },
    };
}

export function sanitizeMaterializedSkillName(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9._-]+/g, '-')
        .replaceAll(/^-+|-+$/g, '');

    return normalized || `skill-${randomUUID().slice(0, 8)}`;
}

export async function copyDirectory(sourceDir: string, targetDir: string) {
    await fs.cp(sourceDir, targetDir, {
        errorOnExist: false,
        force: true,
        recursive: true,
        verbatimSymlinks: false,
    });
}

export async function listSkillFiles(rootDir: string): Promise<AgentRuntimeSkillFile[]> {
    const files: AgentRuntimeSkillFile[] = [];

    async function visit(directory: string) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            const relativePath = path.relative(rootDir, fullPath).replaceAll(path.sep, '/');
            if (entry.isDirectory()) {
                await visit(fullPath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const stat = await fs.stat(fullPath);
            files.push({
                path: relativePath,
                sizeBytes: stat.size,
            });
        }
    }

    await visit(rootDir);
    return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function runGit(args: string[], cwd: string) {
    const { stdout } = await execFileAsync('git', args, {
        cwd,
        maxBuffer: 1024 * 1024 * 20,
    });
    return stdout;
}

async function resolveSkillRoot(rootDir: string) {
    if (await hasSkillFile(rootDir)) {
        return rootDir;
    }

    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());
    for (const directory of directories) {
        const candidate = path.join(rootDir, directory.name);
        if (await hasSkillFile(candidate)) {
            return candidate;
        }
    }

    throw new Error('Skill package is missing SKILL.md.');
}

async function hasSkillFile(directory: string) {
    for (const candidate of skillFileCandidates) {
        try {
            const stat = await fs.stat(path.join(directory, candidate));
            if (stat.isFile()) {
                return true;
            }
        } catch {
            // Try the next candidate.
        }
    }
    return false;
}

async function readSkillFile(rootDir: string) {
    for (const candidate of skillFileCandidates) {
        const filePath = path.join(rootDir, candidate);
        try {
            return {
                content: await fs.readFile(filePath, 'utf8'),
                path: filePath,
            };
        } catch {
            // Try the next candidate.
        }
    }

    throw new Error('Skill package is missing SKILL.md.');
}

async function validateSkillPackageTree(rootDir: string) {
    let fileCount = 0;
    let totalBytes = 0;

    async function visit(directory: string) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            const stat = await fs.lstat(fullPath);
            if (stat.isSymbolicLink()) {
                throw new Error('Skill packages cannot contain symlinks.');
            }
            if (entry.isDirectory()) {
                await visit(fullPath);
                continue;
            }
            if (!entry.isFile()) {
                throw new Error('Skill packages can only contain files and directories.');
            }
            fileCount += 1;
            totalBytes += stat.size;
        }
    }

    await visit(rootDir);

    if (fileCount > 1000) {
        throw new Error('Skill package has too many files.');
    }
    if (totalBytes > 50 * 1024 * 1024) {
        throw new Error('Skill package is larger than 50 MB.');
    }
}

async function hashDirectory(rootDir: string) {
    const files = await listSkillFiles(rootDir);
    const hash = createHash('sha256');

    for (const file of files) {
        const fullPath = path.join(rootDir, file.path);
        hash.update(file.path);
        hash.update('\0');
        hash.update(await fs.readFile(fullPath));
        hash.update('\0');
    }

    return `sha256:${hash.digest('hex')}`;
}
