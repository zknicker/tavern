import { trpc } from '../../lib/trpc.tsx';

async function invalidateVault(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.vault.backlinks.invalidate(),
        utils.vault.get.invalidate(),
        utils.vault.list.invalidate(),
        utils.vault.search.invalidate(),
        utils.vault.status.invalidate(),
    ]);
}

export function useCreateVaultPage() {
    const utils = trpc.useUtils();
    return trpc.vault.createPage.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}

export function useSaveVaultPage() {
    const utils = trpc.useUtils();
    return trpc.vault.savePage.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}

export function useCreateVaultFolder() {
    const utils = trpc.useUtils();
    return trpc.vault.createFolder.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}

export function useDeleteVaultPage() {
    const utils = trpc.useUtils();
    return trpc.vault.deletePage.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}

export function useDeleteVaultFolder() {
    const utils = trpc.useUtils();
    return trpc.vault.deleteFolder.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}

export function useMoveVaultPath() {
    const utils = trpc.useUtils();
    return trpc.vault.movePath.useMutation({
        async onSuccess() {
            await invalidateVault(utils);
        },
    });
}
