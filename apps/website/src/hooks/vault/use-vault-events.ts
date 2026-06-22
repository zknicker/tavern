import { trpc } from '../../lib/trpc.tsx';

export function useVaultEvents() {
    const utils = trpc.useUtils();

    trpc.vault.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const scope = readScope(event);
            const paths = readPaths(event);

            void utils.vault.list.invalidate();
            void utils.vault.status.invalidate();
            void utils.vault.search.invalidate();
            void utils.vault.backlinks.invalidate();

            if (scope === 'root') {
                void utils.vault.settings.invalidate();
                void utils.vault.get.invalidate();
                return;
            }

            if (paths.length === 0) {
                void utils.vault.get.invalidate();
                return;
            }

            for (const path of paths) {
                void utils.vault.get.invalidate({ path });
            }
        },
    });
}

function readScope(input: unknown) {
    if (!(input && typeof input === 'object' && 'scope' in input)) {
        return 'content';
    }

    return (input as Record<string, unknown>).scope === 'root' ? 'root' : 'content';
}

function readPaths(input: unknown) {
    if (!(input && typeof input === 'object' && 'paths' in input)) {
        return [];
    }

    const value = (input as Record<string, unknown>).paths;

    return Array.isArray(value)
        ? value.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
        : [];
}
