import * as React from 'react';
import { writeClipboardText } from '../../lib/clipboard.ts';
import { trpc } from '../../lib/trpc.tsx';
import { buildSessionCopyDump, type SessionCopyDumpInput } from './session-copy-dump.ts';

type CopyTarget = 'all' | 'history' | 'sessionId';

interface UseSessionCopyActionsOptions {
    historyOffset: number | null;
    limit: number;
    sessionId: string;
    sessionKey: string;
}

export function useSessionCopyActions({
    historyOffset,
    limit,
    sessionId,
    sessionKey,
}: UseSessionCopyActionsOptions) {
    const utils = trpc.useUtils();

    async function loadHistoryWindow() {
        const history = await utils.session.history.get.fetch({
            limit,
            offset: historyOffset ?? undefined,
            sessionKey,
        });
        const input = {
            limit,
            offset: history.offset,
            sessionKey,
        } satisfies SessionCopyDumpInput;

        return {
            data: history,
            input,
        };
    }

    async function copyHistory() {
        const { data, input } = await loadHistoryWindow();

        await writeClipboardText(
            buildSessionCopyDump({
                data,
                input,
                procedure: 'session.history.get',
            })
        );
    }

    async function copyAll() {
        const { input } = await loadHistoryWindow();
        const data = await utils.session.get.fetch(input);

        await writeClipboardText(
            buildSessionCopyDump({
                data,
                input,
                procedure: 'session.get',
            })
        );
    }

    async function copySessionId() {
        await writeClipboardText(sessionId);
    }

    async function copy(target: CopyTarget) {
        try {
            if (target === 'history') {
                await copyHistory();
            } else if (target === 'all') {
                await copyAll();
            } else {
                await copySessionId();
            }
        } catch (error) {
            console.error(`Failed to copy ${target} payload`, {
                error,
                input:
                    target === 'sessionId'
                        ? sessionId
                        : {
                              historyOffset,
                              limit,
                              sessionKey,
                          },
            });
        }
    }

    const copySessionIdAction = React.useEffectEvent(() => {
        copy('sessionId').catch(() => undefined);
    });

    const copyHistoryAction = React.useEffectEvent(() => {
        copy('history').catch(() => undefined);
    });

    const copyAllAction = React.useEffectEvent(() => {
        copy('all').catch(() => undefined);
    });

    return {
        copyAllAction,
        copySessionIdAction,
        copyHistoryAction,
    };
}
