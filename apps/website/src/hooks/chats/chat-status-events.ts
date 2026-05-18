import { debugChatEvent, markChatTiming } from '../../lib/chat-timing.ts';
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
        completeTurn: (input: { chatId: string; completedAt: string; turn: ChatTurn }) => void;
        failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
        startTurn: (turn: ChatTurn) => void;
        updateTurnProgress: (input: {
            chatId: string;
            receivedAt: string;
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
    const invalidateLiveTurn = () => {
        Promise.all([
            utils.agent.activity.invalidate(),
            utils.chat.log.list.invalidate(),
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
            debugChatEvent('turn.completed.event', {
                chatId: _turn.chatId,
                runId: _turn.runId,
                sessionKey: _turn.sessionKey,
            });
            utils.timeline.completeTurn({
                chatId: _turn.chatId,
                completedAt: new Date().toISOString(),
                turn: _turn,
            });
            invalidateCompletedTurn();
        },
        onTurnFailed: (input: { error: string; turn: ChatTurn }) => {
            debugChatEvent('turn.failed.event', {
                chatId: input.turn.chatId,
                runId: input.turn.runId,
                sessionKey: input.turn.sessionKey,
            });
            utils.timeline.failTurn({
                chatId: input.turn.chatId,
                error: input.error,
                turn: input.turn,
            });
            invalidateCompletedTurn();
        },
        onTurnProgress: (input: { step: ChatTurnProgressStep; turn: ChatTurn }) => {
            markChatTiming('client.turnProgressEvent', {
                chatId: input.turn.chatId,
                kind: input.step.kind,
                runId: input.turn.runId,
                stepId: input.step.id,
            });
            debugChatEvent('turn.progress.event', {
                chatId: input.turn.chatId,
                kind: input.step.kind,
                label: input.step.label,
                runId: input.turn.runId,
                sessionKey: input.turn.sessionKey,
                status: input.step.status,
                stepId: input.step.id,
            });
            utils.timeline.updateTurnProgress({
                chatId: input.turn.chatId,
                receivedAt: new Date().toISOString(),
                step: input.step,
                turn: input.turn,
            });
            invalidateLiveTurn();
        },
        onTurnReplyUpdated: (update: ChatReplyUpdate) => {
            markChatTiming('client.turnReplyUpdatedEvent', {
                chatId: update.turn.chatId,
                runId: update.turn.runId,
                textLength: update.text.length,
            });
            debugChatEvent('turn.replyUpdated.event', {
                chatId: update.turn.chatId,
                isThinking: update.isThinking ?? null,
                replace: update.replace ?? null,
                runId: update.turn.runId,
                textLength: update.text.length,
            });
            utils.timeline.updateReply(update);
            invalidateLiveTurn();
        },
        onTurnStarted: (turn: ChatTurn) => {
            markChatTiming('client.turnStartedEvent', {
                chatId: turn.chatId,
                runId: turn.runId,
            });
            debugChatEvent('turn.started.event', {
                chatId: turn.chatId,
                runId: turn.runId,
                sessionKey: turn.sessionKey,
            });
            utils.timeline.startTurn(turn);
            invalidateStatus();
        },
    };
}
