import { trpc } from '../../lib/trpc.tsx';

export function useWikiEvents() {
    const utils = trpc.useUtils();

    trpc.wiki.onUpdate.useSubscription(undefined, {
        onData: (event) => {
            const scope = readScope(event);
            const paths = readPaths(event);

            void utils.wiki.list.invalidate();
            void utils.wiki.status.invalidate();
            void utils.wiki.search.invalidate();
            void utils.wiki.backlinks.invalidate();

            if (scope === 'root') {
                void utils.wiki.settings.invalidate();
                void utils.wiki.get.invalidate();
                return;
            }

            if (paths.length === 0) {
                void utils.wiki.get.invalidate();
                return;
            }

            for (const path of paths) {
                void utils.wiki.get.invalidate({ path });
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
