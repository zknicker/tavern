import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { patchLiveChatLogQueries } from './chat-log-query-patch.ts';
import { useTimelineActions } from './use-timeline-context.tsx';

/**
 * Dismisses one timeline row (a command card or failed-turn banner) by
 * soft-deleting its response in Tavern Runtime. The row is removed from the
 * local caches immediately; the durable delete keeps it gone everywhere.
 * See specs/composer-commands.md.
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

function removeResponseFromLog(
    log: ChatLogOutput | undefined,
    responseId: string
): ChatLogOutput | undefined {
    if (!log) {
        return log;
    }

    const rows = log.rows.filter(
        (row) =>
            !(
                row.kind === 'system' &&
                row.systemKind === 'commandRun' &&
                row.commandRun.responseId === responseId
            )
    );
    const removed = log.rows.length - rows.length;
    const failedTurn = log.failedTurn?.responseId === responseId ? null : log.failedTurn;

    if (removed === 0 && failedTurn === log.failedTurn) {
        return log;
    }

    return {
        ...log,
        failedTurn,
        rows,
        total: Math.max(0, log.total - removed),
    };
}
