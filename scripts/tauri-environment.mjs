import path from 'node:path';

export function getTauriEnvironment({
    baseEnvironment = process.env,
    commandArguments = [],
    hasSccache = false,
    homeDirectory,
    platform = process.platform,
    warn = console.warn,
} = {}) {
    const environment = { ...baseEnvironment };

    if (!environment.RUSTC_WRAPPER) {
        if (hasSccache) {
            environment.RUSTC_WRAPPER = 'sccache';
        } else {
            warn(
                '[tavern] sccache not found on PATH; desktop Rust builds will run without a ' +
                    'shared compiler cache.'
            );
        }
    }

    if (!environment.CARGO_TARGET_DIR && shouldUseSharedCargoTargetDirectory(commandArguments)) {
        environment.CARGO_TARGET_DIR = getSharedCargoTargetDirectory({
            baseEnvironment,
            homeDirectory,
            platform,
        });
    }

    return environment;
}

export function shouldUseSharedCargoTargetDirectory(commandArguments) {
    return commandArguments[0] === 'dev';
}

export function getSharedCargoTargetDirectory({
    baseEnvironment = process.env,
    homeDirectory,
    platform = process.platform,
} = {}) {
    const resolvedHomeDirectory = homeDirectory ?? baseEnvironment.HOME ?? process.env.HOME;

    if (!resolvedHomeDirectory) {
        throw new Error('Unable to determine the user home directory for the shared Cargo target.');
    }

    if (platform === 'darwin') {
        return joinForPlatform(
            platform,
            resolvedHomeDirectory,
            'Library',
            'Caches',
            'Tavern',
            'tauri-target'
        );
    }

    if (platform === 'win32') {
        const localAppData =
            baseEnvironment.LOCALAPPDATA ??
            joinForPlatform(platform, resolvedHomeDirectory, 'AppData', 'Local');

        return joinForPlatform(platform, localAppData, 'Tavern', 'tauri-target');
    }

    const xdgCacheHome =
        baseEnvironment.XDG_CACHE_HOME ??
        joinForPlatform(platform, resolvedHomeDirectory, '.cache');

    return joinForPlatform(platform, xdgCacheHome, 'tavern', 'tauri-target');
}

function joinForPlatform(platform, ...parts) {
    if (platform === 'win32') {
        return path.win32.join(...parts);
    }

    return path.posix.join(...parts);
}
