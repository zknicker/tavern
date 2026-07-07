import { debugChatEvent, markChatTiming } from '../../lib/chat-timing.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { patchChatLogWithProgress } from './chat-log-cache.ts';
import type {
    ChatReplyUpdate,
    ChatTurn,
    ChatTurnProgressStep,
    ChatTurnStatusUpdate,
} from './chat-timeline-state.ts';

export interface ChatTurnEventUtils {
    agent: {
        activity: {
            invalidate: () => Promise<unknown>;
        };
    };
    chat: {
        list: {
            invalidate: () => Promise<unknown>;
        };
        log: {
            list: {
                patchProgress: (input: {
                    chatId: string;
                    updater: (current: ChatLogOutput | undefined) => ChatLogOutput | undefined;
                }) => void;
            };
        };
    };
    timeline: {
        clearTurn: (input: { chatId: string; runId?: string }) => void;
        completeTurn: (input: { chatId: string; completedAt: string; turn: ChatTurn }) => void;
        failTurn: (input: { chatId: string; error: string; turn: ChatTurn }) => void;
        patchProgress: (input: {
            step: ChatTurnProgressStep;
            timestamp: string;
            turn: ChatTurn;
        }) => void;
        startTurn: (turn: ChatTurn) => void;
        updateReply: (update: ChatReplyUpdate) => void;
        updateTurnStatus: (update: ChatTurnStatusUpdate) => void;
    };
    worker: {
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
}

export function createChatTurnEventHandlers(utils: ChatTurnEventUtils) {
    const terminalTurnIds = new Set<string>();

    const invalidateLiveTurnStatus = () => {
        Promise.all([utils.agent.activity.invalidate(), utils.worker.list.invalidate()]).catch(
            () => undefined
        );
    };

    // Chat, session, and worker refetches at turn completion ride the named
    // invalidation events (chat.onUpdate, chat.log.onUpdate, session.onUpdate,
    // worker.onUpdate). Invalidating them here as well doubles the refetch
    // burst right as the final message swaps in. Live agent status is the one
    // signal with no named event.
    const invalidateCompletedTurn = () => {
        utils.agent.activity.invalidate().catch(() => undefined);
    };

    const isTerminalRun = (runId: string) =>
        terminalTurnIds.has(`completed:${runId}`) ||
        terminalTurnIds.has(`cancelled:${runId}`) ||
        terminalTurnIds.has(`failed:${runId}`);

    return {
        onTurnCompleted: (_turn: ChatTurn) => {
            if (!rememberTerminalTurn(terminalTurnIds, `completed:${_turn.runId}`)) {
                return;
            }

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
        onTurnCancelled: (turn: ChatTurn) => {
            if (!rememberTerminalTurn(terminalTurnIds, `cancelled:${turn.runId}`)) {
                return;
            }

            debugChatEvent('turn.cancelled.event', {
                chatId: turn.chatId,
                runId: turn.runId,
                sessionKey: turn.sessionKey,
            });
            utils.timeline.clearTurn({
                chatId: turn.chatId,
                runId: turn.runId,
            });
            invalidateCompletedTurn();
        },
        onTurnFailed: (input: { error: string; turn: ChatTurn }) => {
            if (!rememberTerminalTurn(terminalTurnIds, `failed:${input.turn.runId}`)) {
                return;
            }

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
        onTurnProgress: (input: {
            step: ChatTurnProgressStep;
            timestamp?: string;
            turn: ChatTurn;
        }) => {
            if (isTerminalRun(input.turn.runId)) {
                return;
            }
            const timestamp = input.timestamp ?? new Date().toISOString();

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
            utils.timeline.patchProgress({
                step: input.step,
                timestamp,
                turn: input.turn,
            });
            utils.chat.log.list.patchProgress({
                chatId: input.turn.chatId,
                updater: (current) =>
                    patchChatLogWithProgress(current, {
                        step: input.step,
                        timestamp,
                        turn: input.turn,
                    }),
            });
        },
        onTurnReplyUpdated: (update: ChatReplyUpdate) => {
            // A reply update landing after the turn's terminal event would
            // resurrect active state with no terminal event left to clear it.
            if (isTerminalRun(update.turn.runId)) {
                return;
            }
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
        },
        onTurnStatusUpdated: (update: ChatTurnStatusUpdate) => {
            debugChatEvent('turn.statusUpdated.event', {
                chatId: update.turn.chatId,
                runId: update.turn.runId,
                sequence: update.sequence,
            });
            utils.timeline.updateTurnStatus(update);
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
            invalidateLiveTurnStatus();
            void utils.chat.list.invalidate();
        },
    };
}

function rememberTerminalTurn(terminalTurnIds: Set<string>, key: string) {
    if (terminalTurnIds.has(key)) {
        return false;
    }

    terminalTurnIds.add(key);

    if (terminalTurnIds.size > 200) {
        const oldest = terminalTurnIds.values().next().value;
        if (oldest) {
            terminalTurnIds.delete(oldest);
        }
    }

    return true;
}
