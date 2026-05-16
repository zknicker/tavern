import type { AgentRuntimeEvent } from '@tavern/agent-runtime-protocol';
import {
    markAgentRuntimeConnectionFailure,
    markAgentRuntimeConnectionReachable,
} from '../agent-runtime-connection/service.ts';
import {
    emitAgentRuntimeUpdated,
    emitAgentUpdated,
    emitCronUpdated,
    emitSkillInvalidationCascade,
    emitSyncDataUpdated,
    emitWorkersUpdated,
} from '../api/invalidation-events.ts';
import { refreshOpenClawSyncJobSchedules } from '../jobs/manager.ts';
import { listReachableAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import {
    syncAgentRuntimeAgents,
    syncAgentRuntimeCron,
    syncAgentRuntimeSession,
    syncAgentRuntimeSessionMessages,
    syncAgentRuntimeSessionMessagesWithRetry,
} from '../sync/agent-runtime-projections.ts';
import {
    clearTurnSessionActive,
    hasActiveTurnSession,
    markTurnSessionActive,
} from './active-turn-sessions.ts';
import {
    createAgentRuntimeClientForConnection,
    subscribeAgentRuntimeEventsForConnection,
} from './drivers.ts';
import { emitObservedAgentRuntimeEvent } from './events.ts';
import { requestAgentRuntimeSessionSync } from './sync.ts';

type RuntimeConnectionRecord = Awaited<
    ReturnType<typeof listReachableAgentRuntimeConnections>
>[number];

let started = false;
let activeEventConnections = new Map<string, { close(): void }>();
let reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
let connectionRevision = 0;
const eventStreamReconnectDelayMs = 1000;

export async function applyObservedAgentRuntimeEvent(
    event: AgentRuntimeEvent,
    connection?: RuntimeConnectionRecord
) {
    emitObservedAgentRuntimeEvent(event);
    debugTurnEvent(event);

    switch (event.type) {
        case 'agent.updated': {
            void syncAgentRuntimeAgents().catch((error) => {
                console.warn('[tavern] failed to sync agent event projection', error);
            });
            emitAgentUpdated();
            return;
        }
        case 'skill.updated': {
            emitSkillInvalidationCascade();
            return;
        }
        case 'skill.deleted': {
            emitSkillInvalidationCascade();
            return;
        }
        case 'cron.updated':
        case 'cron.deleted': {
            void syncAgentRuntimeCron().catch((error) => {
                console.warn('[tavern] failed to sync cron event projection', error);
            });
            emitCronUpdated();
            emitSyncDataUpdated();
            return;
        }
        case 'cron.runStarted':
        case 'cron.runFinished': {
            void syncAgentRuntimeCron().catch((error) => {
                console.warn('[tavern] failed to sync cron run event projection', error);
            });
            emitCronUpdated();
            emitSyncDataUpdated();
            return;
        }
        case 'turn.progress': {
            markTurnSessionActive(event.turn.sessionKey);
            return;
        }
        case 'turn.started': {
            markTurnSessionActive(event.turn.sessionKey);
            return;
        }
        case 'turn.replyUpdated': {
            markTurnSessionActive(event.turn.sessionKey);
            return;
        }
        case 'turn.completed':
        case 'turn.failed': {
            if (connection) {
                void (async () => {
                    try {
                        await syncTurnSessionMessages(connection, event.turn);
                    } catch (error) {
                        console.warn('[tavern] failed to sync turn projection', error);
                    } finally {
                        clearTurnSessionActive(event.turn.sessionKey);
                    }
                })();
            } else {
                clearTurnSessionActive(event.turn.sessionKey);
            }
            return;
        }
        case 'session.invalidated':
        case 'session.updated': {
            const sessionKey =
                event.type === 'session.updated' ? event.session.key : event.sessionKey;
            if (hasActiveTurnSession(sessionKey)) {
                emitWorkersUpdated();
                emitSyncDataUpdated();
                return;
            }
            if (connection) {
                void syncInvalidatedSession(connection, sessionKey).catch((error) => {
                    console.warn('[tavern] failed to sync invalidated session projection', error);
                });
            } else {
                void requestAgentRuntimeSessionSync();
            }
            emitWorkersUpdated();
            emitSyncDataUpdated();
            return;
        }
    }
}

function debugTurnEvent(event: AgentRuntimeEvent) {
    if (process.env.TAVERN_CHAT_DEBUG !== '1') {
        return;
    }

    switch (event.type) {
        case 'turn.completed':
        case 'turn.failed':
        case 'turn.progress':
        case 'turn.replyUpdated':
        case 'turn.started':
            console.info('[tavern:chat:server]', event.type, {
                runId: event.turn.runId,
                sessionKey: event.turn.sessionKey,
                step:
                    event.type === 'turn.progress'
                        ? {
                              id: event.step.id,
                              kind: event.step.kind,
                              label: event.step.label,
                              status: event.step.status,
                          }
                        : undefined,
                timestamp: event.timestamp,
            });
            return;
        default:
            return;
    }
}

async function syncInvalidatedSession(connection: RuntimeConnectionRecord, sessionKey: string) {
    const client = createAgentRuntimeClientForConnection(connection);

    await syncAgentRuntimeSession({
        client,
        runtimeId: connection.id,
        sessionKey,
    });
    await syncAgentRuntimeSessionMessages({
        client,
        runtimeId: connection.id,
        sessionKey,
    });
}

async function syncTurnSessionMessages(
    connection: RuntimeConnectionRecord,
    turn: Extract<AgentRuntimeEvent, { type: 'turn.completed' | 'turn.failed' }>['turn']
) {
    const client = createAgentRuntimeClientForConnection(connection);

    await syncAgentRuntimeSession({
        client,
        runtimeId: connection.id,
        sessionKey: turn.sessionKey,
    });
    await syncAgentRuntimeSessionMessagesWithRetry({
        agentId: turn.agentId,
        client,
        runtimeId: connection.id,
        sessionKey: turn.sessionKey,
    });
}

function disconnectActiveSockets() {
    for (const connection of activeEventConnections.values()) {
        connection.close();
    }

    activeEventConnections = new Map();
    for (const timer of reconnectTimers.values()) {
        clearTimeout(timer);
    }
    reconnectTimers = new Map();
}

async function markConnectionUnavailable(connection: RuntimeConnectionRecord, error: unknown) {
    await markAgentRuntimeConnectionFailure({
        connectionId: connection.id,
        error,
    });
    await refreshOpenClawSyncJobSchedules();
    emitAgentRuntimeUpdated();
    emitSyncDataUpdated();
}

async function markConnectionReachable(connection: RuntimeConnectionRecord) {
    await markAgentRuntimeConnectionReachable({ connectionId: connection.id });
    await refreshOpenClawSyncJobSchedules();
    emitAgentRuntimeUpdated();
}

function scheduleRuntimeEventReconnect(connection: RuntimeConnectionRecord, revision: number) {
    if (revision !== connectionRevision || reconnectTimers.has(connection.id)) {
        return;
    }

    const timer = setTimeout(() => {
        reconnectTimers.delete(connection.id);
        if (revision === connectionRevision) {
            connectRuntimeEvents(connection, revision);
        }
    }, eventStreamReconnectDelayMs);

    reconnectTimers.set(connection.id, timer);
}

function connectRuntimeEvents(connection: RuntimeConnectionRecord, revision: number) {
    void subscribeAgentRuntimeEventsForConnection(connection, {
        onClose: () => {
            if (revision !== connectionRevision) {
                return;
            }

            activeEventConnections.delete(connection.id);
            void markConnectionUnavailable(connection, new Error('Runtime event stream closed.'));
            scheduleRuntimeEventReconnect(connection, revision);
        },
        onEvent: (event) => {
            if (revision !== connectionRevision) {
                return;
            }

            void applyObservedAgentRuntimeEvent(event, connection).catch((error) => {
                console.warn('[tavern] failed to apply observed runtime event', error);
            });
        },
    })
        .then((subscription) => {
            if (revision !== connectionRevision) {
                subscription.close();
                return;
            }

            activeEventConnections.set(connection.id, subscription);
            void markConnectionReachable(connection).catch((error) => {
                console.warn('[tavern] failed to mark runtime reachable', error);
            });
            void requestAgentRuntimeSessionSync();
            emitCronUpdated();
            emitSyncDataUpdated();
        })
        .catch((error) => {
            if (revision !== connectionRevision) {
                return;
            }

            void markConnectionUnavailable(connection, error);
            scheduleRuntimeEventReconnect(connection, revision);
        });
}

export function refreshAgentRuntimeEventSync() {
    if (!started) {
        return;
    }

    connectionRevision += 1;
    disconnectActiveSockets();

    const revision = connectionRevision;

    void listReachableAgentRuntimeConnections()
        .then((connections) => {
            if (revision !== connectionRevision) {
                return;
            }

            for (const connection of connections) {
                connectRuntimeEvents(connection, revision);
            }
        })
        .catch((error) => {
            console.warn('[tavern] failed to load runtime event connections', error);
        });
}

export function startAgentRuntimeEventSync() {
    if (started) {
        return;
    }

    started = true;
    refreshAgentRuntimeEventSync();
}
