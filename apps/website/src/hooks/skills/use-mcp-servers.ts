import { trpc } from '../../lib/trpc.tsx';

export function useMcpServers(input: { enabled: boolean }) {
    return trpc.skill.mcpServers.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
    });
}

export function useMcpServerAdd() {
    const utils = trpc.useUtils();

    return trpc.skill.addMcpServer.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.skill.mcpServers.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}

export function useMcpServerRemove() {
    const utils = trpc.useUtils();

    return trpc.skill.removeMcpServer.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.mcpServers.invalidate(),
                utils.skill.mcpCatalog.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}

export function useMcpServerTest() {
    return trpc.skill.testMcpServer.useMutation();
}

export function useMcpServerEnabledSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setMcpServerEnabled.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.skill.mcpServers.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}
