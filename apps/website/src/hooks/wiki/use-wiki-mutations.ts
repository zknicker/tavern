import { trpc } from '../../lib/trpc.tsx';

async function invalidateWiki(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.wiki.backlinks.invalidate(),
        utils.wiki.get.invalidate(),
        utils.wiki.list.invalidate(),
        utils.wiki.search.invalidate(),
        utils.wiki.status.invalidate(),
    ]);
}

export function useCreateWikiPage() {
    const utils = trpc.useUtils();
    return trpc.wiki.createPage.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}

export function useSaveWikiPage() {
    const utils = trpc.useUtils();
    return trpc.wiki.savePage.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}

export function useCreateWikiFolder() {
    const utils = trpc.useUtils();
    return trpc.wiki.createFolder.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}

export function useDeleteWikiPage() {
    const utils = trpc.useUtils();
    return trpc.wiki.deletePage.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}

export function useDeleteWikiFolder() {
    const utils = trpc.useUtils();
    return trpc.wiki.deleteFolder.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}

export function useMoveWikiPath() {
    const utils = trpc.useUtils();
    return trpc.wiki.movePath.useMutation({
        async onSuccess() {
            await invalidateWiki(utils);
        },
    });
}
