import * as React from 'react';
import type { WikiPageDetail } from '../../features/wiki/types.ts';
import { loadWikiAttachmentPreview } from '../../features/wiki/wiki-attachments.ts';
import { trpc } from '../../lib/trpc.tsx';
import type { PaneEditorTargetAdapter } from '../pane/use-pane-editor-host.ts';
import { useSaveWikiPage } from './use-wiki-mutations.ts';
import { useWikiStatus } from './use-wiki-status.ts';
import { validateWikiImageFile } from './wiki-image-file.ts';
import {
    refreshWikiPageSnapshot,
    wikiPageSnapshot,
    wikiPaneEditorTargetKey,
} from './wiki-pane-editor-snapshot.ts';

export function useWikiPaneEditorAdapter(
    path: string,
    page: WikiPageDetail | null,
    isLoading = false
): PaneEditorTargetAdapter<WikiPageDetail> & {
    imagePreview: (source: string) => Promise<string>;
    uploadImage: (file: File) => Promise<string>;
} {
    const utils = trpc.useUtils();
    const wikiStatus = useWikiStatus();
    const savePage = useSaveWikiPage();
    const uploadAttachment = trpc.wiki.uploadAttachment.useMutation();
    const snapshot = React.useMemo(() => wikiPageSnapshot(page), [page]);
    const uploadImage = React.useCallback(
        async (file: File) => {
            const mediaType = validateWikiImageFile(file);
            const result = await uploadAttachment.mutateAsync({
                contentBase64: await fileToBase64(file),
                filename: file.name || 'image',
                mediaType,
                pagePath: path,
            });
            return result.markdownPath;
        },
        [path, uploadAttachment]
    );
    const imagePreview = React.useCallback(
        async (source: string) => await loadWikiAttachmentPreview(path, source),
        [path]
    );

    return {
        conflictMessage: (error) => {
            const message = error instanceof Error ? error.message : '';
            return message.includes('changed since it was opened') ? message : null;
        },
        imagePreview,
        isLoading,
        isWriting: savePage.isPending,
        refresh: () =>
            refreshWikiPageSnapshot({
                fetch: () => utils.wiki.get.fetch({ path }),
                invalidate: () => utils.wiki.get.invalidate({ path }),
            }),
        snapshot,
        target: {
            key: wikiPaneEditorTargetKey(wikiStatus.data?.wikiPath ?? page?.wikiPath ?? null, path),
            kind: 'wikiPage',
            label: path,
        },
        uploadImage,
        write: async ({ content, expectedRevision }) => {
            const result = await savePage.mutateAsync({
                body: content,
                expectedHash: expectedRevision,
                path,
            });
            if (!result.page) {
                throw new Error('Wiki save did not return the updated page.');
            }
            return {
                content: result.page.body,
                document: result.page,
                revision: result.page.hash,
            };
        },
    };
}

async function fileToBase64(file: File) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read this image.'));
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            const separator = result.indexOf(',');
            if (separator < 0) {
                reject(new Error('Unable to encode this image.'));
                return;
            }
            resolve(result.slice(separator + 1));
        };
        reader.readAsDataURL(file);
    });
}
