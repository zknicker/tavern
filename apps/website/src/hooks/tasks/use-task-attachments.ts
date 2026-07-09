import { trpc } from '../../lib/trpc.tsx';

const THIRTY_MINUTES_MS = 30 * 60_000;

// Promoted attachment bytes are immutable until the file is re-attached, which
// bumps `promotedAt`. Folding `promotedAt` into the query input keeps it in the
// cache key so a replacement busts the cache; the server ignores the extra field.
export function useTaskAttachmentContent(
    taskId: string,
    attachment: { id: string; promotedAt: string },
    enabled: boolean
) {
    const input = {
        attachmentId: attachment.id,
        promotedAt: attachment.promotedAt,
        taskId,
    } as { attachmentId: string; taskId: string };

    return trpc.tasks.attachment.useQuery(input, {
        enabled,
        gcTime: THIRTY_MINUTES_MS,
        refetchOnMount: false,
        staleTime: Number.POSITIVE_INFINITY,
    });
}

export function useTaskAttachmentDelete() {
    const utils = trpc.useUtils();

    return trpc.tasks.deleteAttachment.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.tasks.get.invalidate(), utils.tasks.list.invalidate()]);
        },
    });
}
