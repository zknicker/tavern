import { trpc } from '../../lib/trpc.tsx';

export function useMcpServers(input: { enabled: boolean }) {
    return trpc.mcp.list.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
    });
}

export function useMcpServerAdd() {
    const utils = trpc.useUtils();

    return trpc.mcp.add.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.mcp.list.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}

export function useMcpServerRemove() {
    const utils = trpc.useUtils();

    return trpc.mcp.remove.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.mcp.list.invalidate(),
                utils.mcp.catalog.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}

export function useMcpServerTest() {
    return trpc.mcp.test.useMutation();
}

export function useMcpServerEnabledSet() {
    const utils = trpc.useUtils();

    return trpc.mcp.setEnabled.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.mcp.list.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}
