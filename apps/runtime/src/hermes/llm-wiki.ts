import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERMES_HOME, RUNTIME_ROOT, readConfigValue, resolveConfiguredPath } from '../config';

export const llmWikiSkillName = 'wiki';

interface ManagedLlmWikiIntegrationInput {
    assetsRoot?: string;
    hermesHome?: string;
    runtimeRoot?: string;
}

export interface ManagedLlmWikiIntegration {
    hubPath: string;
    skillPath: string;
}

export function getManagedLlmWikiPaths(input: ManagedLlmWikiIntegrationInput = {}) {
    const hermesHome = input.hermesHome ?? HERMES_HOME;
    const runtimeRoot = input.runtimeRoot ?? RUNTIME_ROOT;
    return {
        hubPath: resolveManagedWikiHubPath(runtimeRoot),
        skillPath: path.join(hermesHome, 'skills', llmWikiSkillName),
    };
}

export async function prepareManagedLlmWikiIntegration(
    input: ManagedLlmWikiIntegrationInput = {}
): Promise<ManagedLlmWikiIntegration> {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', llmWikiSkillName);
    const { hubPath, skillPath } = getManagedLlmWikiPaths(input);

    await Promise.all([prepareManagedWikiHub(hubPath), syncDirectory(skillSource, skillPath)]);

    return { hubPath, skillPath };
}

export function resolveManagedWikiHubPath(runtimeRoot = RUNTIME_ROOT) {
    const configured =
        readConfigValue('TAVERN_WIKI_HUB_PATH') ?? readConfigValue('TAVERN_CORTEX_WIKI_PATH');
    if (configured) {
        return resolveConfiguredPath(configured);
    }

    return path.join(runtimeRoot, 'wiki');
}

export function resolveRuntimeAssetsRoot() {
    const configured = readConfigValue('TAVERN_RUNTIME_ASSETS_DIR');
    if (configured) {
        return resolveConfiguredPath(configured);
    }

    const executableAssets = path.resolve(
        path.dirname(process.execPath),
        '..',
        'share',
        'tavern',
        'runtime-assets'
    );
    if (['tavern', 'tavern-runtime'].includes(path.basename(process.execPath))) {
        return executableAssets;
    }

    return resolveSourceAssetsRoot();
}

function resolveSourceAssetsRoot() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.resolve(moduleDir, '..', 'assets'),
        path.resolve(moduleDir, '..', '..', 'assets'),
    ];
    return candidates.find((candidate) => fsSync.existsSync(candidate)) ?? candidates.at(-1)!;
}

async function prepareManagedWikiHub(hubPath: string) {
    await fs.mkdir(path.join(hubPath, 'topics'), { recursive: true });
    await writeIfMissing(
        path.join(hubPath, 'wikis.json'),
        `${JSON.stringify(emptyWikiRegistry, null, 2)}\n`
    );
    await writeIfMissing(
        path.join(hubPath, '_index.md'),
        ['# Tavern Wiki Hub', '', 'Topic wikis live under `topics/`.', ''].join('\n')
    );
    await writeIfMissing(path.join(hubPath, 'log.md'), '# Wiki Activity Log\n');
}

const emptyWikiRegistry = {
    default: '<HUB>',
    local_wikis: [],
    wikis: {
        hub: {
            description: 'Global knowledge base',
            path: '<HUB>',
        },
    },
};

async function writeIfMissing(filePath: string, content: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { flag: 'wx' }).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    });
}

export async function syncDirectory(source: string, target: string) {
    await fs.rm(target, { force: true, recursive: true });
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, {
        errorOnExist: false,
        force: true,
        recursive: true,
        verbatimSymlinks: true,
    });
}
