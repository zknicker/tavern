import path from 'node:path';

/**
 * Loads the qmd search engine at runtime instead of bundling it: qmd carries
 * native modules (better-sqlite3, sqlite-vec, node-llama-cpp) that cannot be
 * compiled into the single-file Runtime binary. Dev resolves the workspace
 * package; the packaged Runtime resolves the copy staged under
 * `share/grotto/node_modules` by the release artifact build.
 */

type QmdModule = typeof import('@tobilu/qmd');

let loaded: Promise<QmdModule> | null = null;

export function loadQmd(): Promise<QmdModule> {
    configureQmdRuntimeEnvironment(process.platform, process.env);
    loaded ??= importQmd();
    return loaded;
}

export function configureQmdRuntimeEnvironment(platform: NodeJS.Platform, env: NodeJS.ProcessEnv) {
    if (
        platform === 'darwin' &&
        env.QMD_METAL_KEEP_RESIDENCY !== '1' &&
        !env.GGML_METAL_NO_RESIDENCY
    ) {
        env.GGML_METAL_NO_RESIDENCY = '1';
    }
}

async function importQmd(): Promise<QmdModule> {
    const override = process.env.TAVERN_RUNTIME_QMD_PATH?.trim();
    if (override) {
        return (await import(override)) as QmdModule;
    }

    const workspaceSpecifier = '@tobilu/qmd';
    try {
        return (await import(workspaceSpecifier)) as QmdModule;
    } catch {
        return (await import(stagedQmdEntry())) as QmdModule;
    }
}

function stagedQmdEntry() {
    return path.join(
        path.dirname(process.execPath),
        '..',
        'share',
        'grotto',
        'node_modules',
        '@tobilu',
        'qmd',
        'dist',
        'index.js'
    );
}
