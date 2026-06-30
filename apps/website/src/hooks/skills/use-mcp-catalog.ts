import { trpc } from '../../lib/trpc.tsx';

const catalogStaleTimeMs = 5 * 60 * 1000;

export function useMcpCatalog(input: { enabled: boolean }) {
    return trpc.mcp.catalog.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
        staleTime: catalogStaleTimeMs,
    });
}

export function useMcpCatalogInstall() {
    const utils = trpc.useUtils();

    return trpc.mcp.install.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.mcp.catalog.invalidate(),
                utils.mcp.list.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
