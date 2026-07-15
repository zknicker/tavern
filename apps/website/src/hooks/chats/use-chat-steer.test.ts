import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    patchChatLogWithSteerNotice,
    readChatLogSteerNotice,
    rollbackChatLogSteerNotice,
} from './chat-log-cache.ts';
import type { ChatSteerNoticeSnapshots } from './chat-steer-mutation.ts';
import { createChatSteerMutationHandlers } from './chat-steer-mutation.ts';

function emptyLog(): ChatLogOutput {
    return {
        activeReplies: [],
        failedTurns: [],
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        settledRunIds: [],
        totalMessages: 0,
    };
}

test('useChatSteer shows the steer row before runtime accepts it', async () => {
    const invalidatedQueries: string[] = [];
    let log = emptyLog();
    const mutation = createChatSteerMutationHandlers({
        chat: {
            get: {
                invalidate: async ({ chatId }) => {
                    invalidatedQueries.push(`chat.get:${chatId}`);
                },
            },
            log: {
                list: {
                    invalidate: async ({ id }) => {
                        invalidatedQueries.push(`chat.log.list:${id}`);
                    },
                },
            },
        },
        rollbackSteerNotice: ({ content, previousNotice, runId }) => {
            log =
                rollbackChatLogSteerNotice(log, {
                    content,
                    previousNotice: previousNotice.liveLog,
                    runId,
                }) ?? log;
        },
        session: {
            list: {
                invalidate: async () => {
                    invalidatedQueries.push('session.list');
                },
            },
        },
        showSteerNotice: ({ content, runId, timestamp }) => {
            const previousNotice = readChatLogSteerNotice(log, { runId });
            log = patchChatLogWithSteerNotice(log, { content, runId, timestamp }) ?? log;
            return previousSnapshots({ liveLog: previousNotice });
        },
    });
    const input = {
        chatId: 'chat-1',
        content: 'use the newer wording',
        runId: 'run-1',
    };

    const context = await mutation.onMutate(input);

    expect(invalidatedQueries).toEqual([]);
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toMatchObject({
        id: 'act_run-1_runtime_notice_steered_message',
        kind: 'message',
        message: {
            content: 'use the newer wording',
            sender: 'You',
            senderType: 'user',
        },
    });

    await mutation.onSuccess({ steered: true }, input, context);

    expect(invalidatedQueries).toEqual(['chat.get:chat-1', 'chat.log.list:chat-1', 'session.list']);
    expect(log.rows).toHaveLength(1);
});

test('useChatSteer rolls back the optimistic row when runtime rejects it', async () => {
    let log = emptyLog();
    const mutation = createChatSteerMutationHandlers({
        chat: noopChatUtils(),
        rollbackSteerNotice: ({ content, previousNotice, runId }) => {
            log =
                rollbackChatLogSteerNotice(log, {
                    content,
                    previousNotice: previousNotice.liveLog,
                    runId,
                }) ?? log;
        },
        session: noopSessionUtils(),
        showSteerNotice: ({ content, runId, timestamp }) => {
            const previousNotice = readChatLogSteerNotice(log, { runId });
            log = patchChatLogWithSteerNotice(log, { content, runId, timestamp }) ?? log;
            return previousSnapshots({ liveLog: previousNotice });
        },
    });
    const input = {
        chatId: 'chat-1',
        content: 'too late?',
        runId: 'run-1',
    };

    const context = await mutation.onMutate(input);
    await mutation.onSuccess({ steered: false }, input, context);

    expect(log.rows).toEqual([]);
});

test('useChatSteer error rollback keeps a newer optimistic steer row', async () => {
    let log = emptyLog();
    const mutation = createChatSteerMutationHandlers({
        chat: noopChatUtils(),
        rollbackSteerNotice: ({ content, previousNotice, runId }) => {
            log =
                rollbackChatLogSteerNotice(log, {
                    content,
                    previousNotice: previousNotice.liveLog,
                    runId,
                }) ?? log;
        },
        session: noopSessionUtils(),
        showSteerNotice: ({ content, runId, timestamp }) => {
            const previousNotice = readChatLogSteerNotice(log, { runId });
            log = patchChatLogWithSteerNotice(log, { content, runId, timestamp }) ?? log;
            return previousSnapshots({ liveLog: previousNotice });
        },
    });
    const first = {
        chatId: 'chat-1',
        content: 'first steering text',
        runId: 'run-1',
    };
    const second = {
        chatId: 'chat-1',
        content: 'second steering text',
        runId: 'run-1',
    };

    const firstContext = await mutation.onMutate(first);
    await mutation.onMutate(second);
    mutation.onError(new Error('first failed'), first, firstContext);

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toMatchObject({
        message: {
            content: 'second steering text',
        },
    });
});

test('useChatSteer restores a previous accepted row when a later steer fails', async () => {
    let log = emptyLog();
    const mutation = createChatSteerMutationHandlers({
        chat: noopChatUtils(),
        rollbackSteerNotice: ({ content, previousNotice, runId }) => {
            log =
                rollbackChatLogSteerNotice(log, {
                    content,
                    previousNotice: previousNotice.liveLog,
                    runId,
                }) ?? log;
        },
        session: noopSessionUtils(),
        showSteerNotice: ({ content, runId, timestamp }) => {
            const previousNotice = readChatLogSteerNotice(log, { runId });
            log = patchChatLogWithSteerNotice(log, { content, runId, timestamp }) ?? log;
            return previousSnapshots({ liveLog: previousNotice });
        },
    });
    const first = {
        chatId: 'chat-1',
        content: 'first accepted steer',
        runId: 'run-1',
    };
    const second = {
        chatId: 'chat-1',
        content: 'second failed steer',
        runId: 'run-1',
    };

    const firstContext = await mutation.onMutate(first);
    await mutation.onSuccess({ steered: true }, first, firstContext);
    const secondContext = await mutation.onMutate(second);
    mutation.onError(new Error('second failed'), second, secondContext);

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toMatchObject({
        message: {
            content: 'first accepted steer',
        },
    });
});

test('useChatSteer rolls back the handoff timeline snapshot separately', async () => {
    let liveLog = emptyLog();
    let handoffLog = emptyLog();
    const mutation = createChatSteerMutationHandlers({
        chat: noopChatUtils(),
        rollbackSteerNotice: ({ content, previousNotice, runId }) => {
            liveLog =
                rollbackChatLogSteerNotice(liveLog, {
                    content,
                    previousNotice: previousNotice.liveLog,
                    runId,
                }) ?? liveLog;
            handoffLog =
                rollbackChatLogSteerNotice(handoffLog, {
                    content,
                    previousNotice: previousNotice.timeline,
                    runId,
                }) ?? handoffLog;
        },
        session: noopSessionUtils(),
        showSteerNotice: ({ content, runId, timestamp }) => {
            const liveLogPrevious = readChatLogSteerNotice(liveLog, { runId });
            const timelinePrevious = readChatLogSteerNotice(handoffLog, { runId });
            liveLog =
                patchChatLogWithSteerNotice(liveLog, { content, runId, timestamp }) ?? liveLog;
            handoffLog =
                patchChatLogWithSteerNotice(handoffLog, { content, runId, timestamp }) ??
                handoffLog;

            return previousSnapshots({
                liveLog: liveLogPrevious,
                timeline: timelinePrevious,
            });
        },
    });
    const input = {
        chatId: 'chat-1',
        content: 'new steer fails',
        runId: 'run-1',
    };

    const firstContext = await mutation.onMutate({
        ...input,
        content: 'accepted handoff steer',
    });
    await mutation.onSuccess({ steered: true }, input, firstContext);
    const secondContext = await mutation.onMutate(input);
    mutation.onError(new Error('second failed'), input, secondContext);

    expect(liveLog.rows[0]).toMatchObject({
        message: { content: 'accepted handoff steer' },
    });
    expect(handoffLog.rows[0]).toMatchObject({
        message: { content: 'accepted handoff steer' },
    });
});

function noopChatUtils() {
    return {
        get: {
            invalidate: async (_input: { chatId: string }) => undefined,
        },
        log: {
            list: {
                invalidate: async (_input: { id: string }) => undefined,
            },
        },
    };
}

function previousSnapshots(
    input: Partial<ChatSteerNoticeSnapshots> = {}
): ChatSteerNoticeSnapshots {
    return {
        liveLog: input.liveLog ?? null,
        timeline: input.timeline ?? null,
    };
}

function noopSessionUtils() {
    return {
        list: {
            invalidate: async () => undefined,
        },
    };
}
