import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { HERMES_HOME, readConfigValue, resolveConfiguredPath } from '../config';
import { log } from '../log';
import { managedHermesSetupError } from './errors';
import { resolveRuntimeAssetsRoot } from './llm-wiki';
import {
    managedMnemosyneMarker,
    managedMnemosynePluginManifest,
    managedMnemosynePluginSource,
} from './mnemosyne-shim';

const mnemosynePluginName = 'mnemosyne';
const mnemosynePackageImport = 'mnemosyne_hermes';
const mnemosyneCoreImport = 'mnemosyne';
const mnemosynePackageSpec = 'mnemosyne-hermes==0.1.5';
const execFileAsync = promisify(execFile);

interface ManagedMnemosyneInput {
    assetsRoot?: string;
    hermesHome?: string;
}

interface ManagedMnemosynePackageInput extends ManagedMnemosyneInput {
    hermesBinary: string;
}

export function getManagedMnemosynePluginPath(input: ManagedMnemosyneInput = {}) {
    return path.join(input.hermesHome ?? HERMES_HOME, 'plugins', mnemosynePluginName);
}

export async function ensureManagedMnemosynePlugin(input: ManagedMnemosyneInput = {}) {
    const pluginPath = getManagedMnemosynePluginPath(input);

    if (await hasUnmanagedPlugin(pluginPath)) {
        return { managed: false, pluginPath };
    }

    await fs.rm(pluginPath, { force: true, recursive: true });
    await fs.mkdir(pluginPath, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(pluginPath, managedMnemosyneMarker), ''),
        fs.writeFile(path.join(pluginPath, 'plugin.yaml'), managedMnemosynePluginManifest),
        fs.writeFile(path.join(pluginPath, '__init__.py'), managedMnemosynePluginSource),
    ]);

    return { managed: true, pluginPath };
}

export async function ensureManagedMnemosynePackage(input: ManagedMnemosynePackageInput) {
    const pythonPath = await resolveHermesPythonPath(input.hermesBinary);
    if (!pythonPath) {
        const candidates = await collectHermesPythonCandidates(input.hermesBinary);
        throw managedHermesSetupError(
            [
                "The agent engine's Python interpreter was not found, so agent memory cannot be set up.",
                `Looked for an executable "python" at: ${candidates.join(', ') || '(no candidates)'}.`,
                "Set TAVERN_HERMES_PYTHON_BIN to the engine's Python executable.",
            ].join(' ')
        );
    }

    if (await canImportMnemosynePackage(pythonPath)) {
        return { installed: false, pythonPath };
    }

    const packageSpec = readConfigValue('TAVERN_MNEMOSYNE_PACKAGE_SPEC') ?? mnemosynePackageSpec;
    const wheelhousePath = await resolveMnemosyneWheelhousePath(input);
    const args = buildMnemosyneInstallArgs({ packageSpec, wheelhousePath });

    log.info('Installing managed Mnemosyne package for Hermes', {
        packageSpec,
        pythonPath,
        source: wheelhousePath ? 'bundled-wheelhouse' : 'python-index',
    });
    await execFileAsync(pythonPath, args, {
        env: {
            ...process.env,
            HERMES_HOME: input.hermesHome ?? HERMES_HOME,
        },
        maxBuffer: 1024 * 1024,
        timeout: 300_000,
    });

    if (!(await canImportMnemosynePackage(pythonPath))) {
        throw managedHermesSetupError(
            `The agent memory package installed but is not importable by the engine's Python at ${pythonPath}.`
        );
    }

    return { installed: true, pythonPath };
}

export async function resolveHermesPythonPath(hermesBinary: string) {
    for (const candidate of await collectHermesPythonCandidates(hermesBinary)) {
        if (await isExecutable(candidate)) {
            return candidate;
        }
    }

    return null;
}

async function collectHermesPythonCandidates(hermesBinary: string) {
    const override = readConfigValue('TAVERN_HERMES_PYTHON_BIN');
    const candidates = override ? [resolveConfiguredPath(override)] : [];

    candidates.push(
        path.join(path.dirname(hermesBinary), 'python'),
        path.join(path.dirname(await fs.realpath(hermesBinary).catch(() => hermesBinary)), 'python')
    );

    const wrappedHermes = await readHermesWrapperTarget(hermesBinary);
    if (wrappedHermes) {
        candidates.push(path.join(path.dirname(wrappedHermes), 'python'));
    }

    return unique(candidates);
}

export function buildMnemosyneInstallArgs(input: {
    packageSpec: string;
    wheelhousePath: null | string;
}) {
    const base = ['-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade'];
    if (!input.wheelhousePath) {
        return [...base, input.packageSpec];
    }

    return [...base, '--no-index', '--find-links', input.wheelhousePath, input.packageSpec];
}

async function hasUnmanagedPlugin(pluginPath: string) {
    const stats = await fs.lstat(pluginPath).catch(() => null);
    if (!stats) {
        return false;
    }
    if (stats.isSymbolicLink()) {
        return true;
    }
    const marker = path.join(pluginPath, managedMnemosyneMarker);
    return !(await fs
        .stat(marker)
        .then(() => true)
        .catch(() => false));
}

async function canImportMnemosynePackage(pythonPath: string) {
    const script = [
        'import importlib.util, sys',
        `sys.exit(0 if importlib.util.find_spec("${mnemosynePackageImport}") and importlib.util.find_spec("${mnemosyneCoreImport}") else 1)`,
    ].join('\n');
    return await execFileAsync(pythonPath, ['-c', script], {
        maxBuffer: 1024 * 128,
        timeout: 30_000,
    })
        .then(() => true)
        .catch(() => false);
}

async function resolveMnemosyneWheelhousePath(input: ManagedMnemosyneInput) {
    const wheelhousePath = path.join(
        input.assetsRoot ?? resolveRuntimeAssetsRoot(),
        'python',
        'mnemosyne'
    );
    const entries = await fs.readdir(wheelhousePath).catch(() => []);
    return entries.length > 0 ? wheelhousePath : null;
}

async function readHermesWrapperTarget(hermesBinary: string) {
    const raw = await fs.readFile(hermesBinary, 'utf8').catch(() => null);
    if (!raw) {
        return null;
    }

    const execLine = raw
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('exec '));
    if (!execLine) {
        return null;
    }

    const match = execLine.match(/^exec\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/u);
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

async function isExecutable(filePath: string) {
    return await fs
        .access(filePath, fsConstants.X_OK)
        .then(() => true)
        .catch(() => false);
}

function unique(values: string[]) {
    return [...new Set(values)];
}
