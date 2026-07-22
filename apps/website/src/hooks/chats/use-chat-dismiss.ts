import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { patchLiveChatLogQueries } from './chat-log-query-patch.ts';
import { useTimelineActions } from './use-timeline-context.tsx';

/**
 * Dismisses a failed-turn banner by soft-deleting its response in Tavern
 * Runtime. The banner is removed from the local caches immediately; the
 * durable delete keeps it gone everywhere.
 */
export function useChatDismiss(chatId: string | undefined) {
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();
    const { dismissFailure } = useTimelineActions();
    const mutation = trpc.chat.log.dismiss.useMutation({
        onSettled: () => utils.chat.log.list.invalidate().catch(() => undefined),
    });

    const dismissRow = React.useCallback(
        (responseId: string) => {
            if (!chatId) {
                return;
            }

            patchLiveChatLogQueries(queryClient, chatId, (log) =>
                removeResponseFromLog(log, responseId)
            );
            dismissFailure({ chatId, responseId });
            mutation.mutate({ chatId, responseId });
        },
        [chatId, dismissFailure, mutation.mutate, queryClient]
    );

    return { dismissRow };
}

// The chat log no longer carries failed-turn banners (specs/chat-timeline.md):
// dismissal is purely the durable soft-delete plus the local timeline-state
// patch above; the log cache itself has nothing left to strip.
function removeResponseFromLog(
    log: ChatLogOutput | undefined,
    _responseId: string
): ChatLogOutput | undefined {
    return log;
}
