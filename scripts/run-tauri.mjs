import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDevPorts } from './dev-ports.mjs';
import { getTauriEnvironment } from './tauri-environment.mjs';

export function getTauriArguments({
    baseEnvironment = process.env,
    commandArguments = process.argv.slice(2),
} = {}) {
    if (commandArguments.length === 0) {
        return ['--help'];
    }

    if (commandArguments[0] === 'build') {
        return addFeature(commandArguments, 'updater');
    }

    if (commandArguments[0] !== 'dev') {
        return commandArguments;
    }

    const { beforeDevCommand, remainingArguments } = parseTauriDevArguments(
        commandArguments.slice(1)
    );
    const { websitePort } = resolveDevPorts({ baseEnvironment });
    const buildConfig = {
        devUrl: `http://localhost:${websitePort}`,
        ...(beforeDevCommand ? { beforeDevCommand } : {}),
    };

    return [
        'dev',
        '--config',
        JSON.stringify({
            build: buildConfig,
        }),
        ...remainingArguments,
    ];
}

function addFeature(commandArguments, feature) {
    if (hasFeature(commandArguments, feature)) {
        return commandArguments;
    }

    return [...commandArguments, '--features', feature];
}

function hasFeature(commandArguments, feature) {
    for (let index = 0; index < commandArguments.length; index += 1) {
        const argument = commandArguments[index];

        if (
            (argument === '--features' || argument === '-F') &&
            hasFeatureValue(commandArguments[index + 1], feature)
        ) {
            return true;
        }

        if (
            argument.startsWith('--features=') &&
            hasFeatureValue(argument.slice('--features='.length), feature)
        ) {
            return true;
        }

        if (argument.startsWith('-F') && hasFeatureValue(argument.slice(2), feature)) {
            return true;
        }
    }

    return false;
}

function hasFeatureValue(value, feature) {
    return typeof value === 'string' && value.split(/[,\s]+/u).includes(feature);
}

function parseTauriDevArguments(commandArguments) {
    const remainingArguments = [];
    let beforeDevCommand;

    for (let index = 0; index < commandArguments.length; index += 1) {
        const argument = commandArguments[index];

        if (argument === '--before-dev-command') {
            const nextValue = commandArguments[index + 1];

            if (!nextValue) {
                throw new Error('Missing value for --before-dev-command.');
            }

            beforeDevCommand = nextValue;
            index += 1;
            continue;
        }

        remainingArguments.push(argument);
    }

    return {
        beforeDevCommand,
        remainingArguments,
    };
}

function main() {
    const commandArguments = process.argv.slice(2);
    const tauriArguments = getTauriArguments({ commandArguments });
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const repositoryRoot = path.resolve(currentDirectory, '..');
    const websiteDirectory = path.join(repositoryRoot, 'apps', 'website');
    const tauriEnvironment = getTauriEnvironment({
        commandArguments,
        hasSccache: hasSccacheOnPath(),
    });

    if (tauriEnvironment.CARGO_TARGET_DIR) {
        mkdirSync(tauriEnvironment.CARGO_TARGET_DIR, { recursive: true });
    }

    const child = spawn('bun', ['x', 'tauri', ...tauriArguments], {
        cwd: websiteDirectory,
        env: tauriEnvironment,
        stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 1);
    });

    child.on('error', (error) => {
        console.error(error);
        process.exit(1);
    });
}

function hasSccacheOnPath() {
    const sccacheVersion = spawnSync('sccache', ['--version'], { stdio: 'ignore' });

    return sccacheVersion.status === 0;
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main();
}
