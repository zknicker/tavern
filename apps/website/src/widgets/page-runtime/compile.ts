import { transform } from 'sucrase';

/**
 * TSX page compile pipeline shared by the sandboxed iframe runtime (entry.tsx)
 * and website tests. The page source is attacker-controlled: compilation and
 * evaluation happen only inside the opaque-origin iframe; tests exercise the
 * same functions directly. Only the module specifiers in `pageImportAllowlist`
 * resolve — any other import (URLs above all) throws before the page mounts,
 * so a failed page never renders partially.
 */

export const pageSourceMaxBytes = 512 * 1024;

export const pageImportAllowlist = ['react', 'react/jsx-runtime', '@tavern/kit'] as const;

export class PageRenderError extends Error {}

export function compilePageTsx(source: string): string {
    if (new TextEncoder().encode(source).byteLength > pageSourceMaxBytes) {
        throw new PageRenderError('This page file is too large to render (512 KB limit).');
    }

    try {
        return transform(source, {
            filePath: 'page.tsx',
            jsxRuntime: 'automatic',
            // Without this, the TypeScript transform elides unused imports and
            // a disallowed specifier could pass unnoticed; every import must
            // hit the allowlisted require shim, used or not.
            keepUnusedImports: true,
            production: true,
            transforms: ['typescript', 'jsx', 'imports'],
        }).code;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new PageRenderError(`TSX compile failed: ${message}`);
    }
}

export type PageModules = Record<string, Record<string, unknown>>;

/**
 * Shape each provided namespace so both `import * as X` / named imports and
 * `import X from ...` default imports resolve through sucrase's CJS interop.
 */
export function buildPageModules(namespaces: {
    kit: Record<string, unknown>;
    jsxRuntime: Record<string, unknown>;
    react: Record<string, unknown>;
}): PageModules {
    return {
        '@tavern/kit': interopModule(namespaces.kit),
        react: interopModule(namespaces.react),
        'react/jsx-runtime': interopModule(namespaces.jsxRuntime),
    };
}

export function evaluatePageModule(code: string, modules: PageModules): unknown {
    const requireModule = (specifier: string) => {
        const resolved = modules[specifier];
        if (!resolved) {
            throw new PageRenderError(
                `Import "${specifier}" is not available in a Tavern page. Only "react" and "@tavern/kit" can be imported.`
            );
        }
        return resolved;
    };

    const moduleRecord: { exports: Record<string, unknown> } = { exports: {} };
    // Evaluation is confined to the opaque-origin iframe (or a test process);
    // the iframe sandbox, not this function, is the security boundary.
    const run = new Function('require', 'module', 'exports', code);
    run(requireModule, moduleRecord, moduleRecord.exports);

    const component = moduleRecord.exports.default;
    if (typeof component !== 'function') {
        throw new PageRenderError('The page must default-export a React component.');
    }

    return component;
}

function interopModule(namespace: Record<string, unknown>): Record<string, unknown> {
    return { ...namespace, __esModule: true, default: namespace.default ?? namespace };
}
