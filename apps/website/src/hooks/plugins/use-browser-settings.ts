import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useBrowserSettings() {
    return trpc.plugin.browserSettings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveBrowserSettings() {
    const utils = trpc.useUtils();
    return trpc.plugin.saveBrowserSettings.useMutation({
        async onSuccess() {
            await invalidateBrowserPluginQueries(utils);
        },
    });
}

export function useOpenBrowser() {
    const utils = trpc.useUtils();
    return trpc.plugin.openBrowser.useMutation({
        async onSuccess() {
            await utils.plugin.browserSettings.invalidate();
        },
    });
}

export function useRestartBrowser() {
    const utils = trpc.useUtils();
    return trpc.plugin.restartBrowser.useMutation({
        async onSuccess() {
            await utils.plugin.browserSettings.invalidate();
        },
    });
}

async function invalidateBrowserPluginQueries(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.plugin.browserSettings.invalidate(),
        utils.plugin.list.invalidate(),
        utils.agentRuntime.get.invalidate(),
        utils.skill.list.invalidate(),
    ]);
}
