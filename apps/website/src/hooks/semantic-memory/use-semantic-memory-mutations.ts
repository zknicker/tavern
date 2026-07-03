import { trpc } from '../../lib/trpc.tsx';

async function invalidateSemanticMemory(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.semanticMemory.backlinks.invalidate(),
        utils.semanticMemory.get.invalidate(),
        utils.semanticMemory.list.invalidate(),
        utils.semanticMemory.search.invalidate(),
        utils.semanticMemory.status.invalidate(),
    ]);
}

export function useCreateSemanticMemoryPage() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.createPage.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}

export function useSaveSemanticMemoryPage() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.savePage.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}

export function useCreateSemanticMemoryFolder() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.createFolder.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}

export function useDeleteSemanticMemoryPage() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.deletePage.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}

export function useDeleteSemanticMemoryFolder() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.deleteFolder.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}

export function useMoveSemanticMemoryPath() {
    const utils = trpc.useUtils();
    return trpc.semanticMemory.movePath.useMutation({
        async onSuccess() {
            await invalidateSemanticMemory(utils);
        },
    });
}
