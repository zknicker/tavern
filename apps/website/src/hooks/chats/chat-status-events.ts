import type { ChatReplyUpdate, ChatTurn, ChatTurnProgressStep } from './chat-timeline-state.ts';

export interface ChatStatusEventUtils {
    agent: {
        activity: {
            invalidate: () => Promise<unknown>;
        };
    };
    chat: {
        log: {
            list: {
                invalidate: () => Promise<unknown>;
            };
        };
        status: {
            list: {
                invalidate: () => Promise<unknown>;
            };
        };
    };
    session: {
        get: {
            invalidate: () => Promise<unknown>;
        };
        history: {
            get: {
                invalidate: () => Promise<unknown>;
            };
        };
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
    timeline: {
        clearTurn: (input: { chatId: string; runId?: string }) => void;
        failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
        startTurn: (turn: ChatTurn) => void;
        updateTurnProgress: (input: {
            chatId: string;
            step: ChatTurnProgressStep;
            turn: ChatTurn;
        }) => void;
        updateReply: (update: ChatReplyUpdate) => void;
    };
    worker: {
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
}

export function createChatStatusEventHandlers(utils: ChatStatusEventUtils) {
    const invalidateStatus = () => {
        Promise.all([
            utils.agent.activity.invalidate(),
            utils.chat.status.list.invalidate(),
            utils.worker.list.invalidate(),
        ]).catch(() => undefined);
    };

    const invalidateCompletedTurn = () => {
        Promise.all([
            utils.agent.activity.invalidate(),
            utils.chat.log.list.invalidate(),
            utils.chat.status.list.invalidate(),
            utils.session.get.invalidate(),
            utils.session.history.get.invalidate(),
            utils.session.list.invalidate(),
            utils.worker.list.invalidate(),
        ]).catch(() => undefined);
    };

    return {
        onTurnCompleted: (_turn: ChatTurn) => {
            invalidateCompletedTurn();
        },
        onTurnFailed: (input: { error: string; turn: ChatTurn }) => {
            utils.timeline.failTurn({
                chatId: input.turn.chatId,
                error: input.error,
                turn: input.turn,
            });
            invalidateCompletedTurn();
        },
        onTurnProgress: (input: { step: ChatTurnProgressStep; turn: ChatTurn }) => {
            utils.timeline.updateTurnProgress({
                chatId: input.turn.chatId,
                step: input.step,
                turn: input.turn,
            });
        },
        onTurnReplyUpdated: (update: ChatReplyUpdate) => {
            utils.timeline.updateReply(update);
        },
        onTurnStarted: (turn: ChatTurn) => {
            utils.timeline.startTurn(turn);
            invalidateStatus();
        },
    };
}
