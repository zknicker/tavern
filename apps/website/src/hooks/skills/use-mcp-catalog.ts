import { trpc } from '../../lib/trpc.tsx';

const catalogStaleTimeMs = 5 * 60 * 1000;

export function useMcpCatalog(input: { enabled: boolean }) {
    return trpc.skill.mcpCatalog.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
        staleTime: catalogStaleTimeMs,
    });
}

export function useMcpCatalogInstall() {
    const utils = trpc.useUtils();

    return trpc.skill.installMcpCatalogEntry.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.mcpCatalog.invalidate(),
                utils.skill.mcpServers.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
