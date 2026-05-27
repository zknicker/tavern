import type { AgentRuntimeEvent } from '@tavern/api';
import { refreshOpenClawGatewayCapability } from '../agent-runtime-connection/openclaw-gateway-capability.ts';
import {
    confirmAgentRuntimeConnection,
    markAgentRuntimeConnectionFailure,
    markAgentRuntimeConnectionReachable,
} from '../agent-runtime-connection/service.ts';
import { recordTavernPluginCapability } from '../agent-runtime-connection/tavern-plugin-capability.ts';
import {
    emitAgentRuntimeUpdated,
    emitAgentUpdated,
    emitChatLogUpdated,
    emitChatUpdated,
    emitCronUpdated,
    emitModelUpdated,
    emitSessionUpdated,
    emitSkillInvalidationCascade,
    emitWorkersUpdated,
} from '../api/invalidation-events.ts';
import { listReachableAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import { syncAgentRuntimeAgents, syncAgentRuntimeCron } from '../sync/agent-runtime-sync.ts';
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
    switch (event.type) {
        case 'agent.updated': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            void syncAgentRuntimeAgents().catch((error) => {
                console.warn('[tavern] failed to sync agent event', error);
            });
            emitAgentUpdated();
            return;
        }
        case 'chat.messageAccepted': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            emitChatUpdated();
            emitChatLogUpdated();
            return;
        }
        case 'chat.read': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            emitChatUpdated();
            return;
        }
        case 'model.updated': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            emitModelUpdated();
            return;
        }
        case 'skill.updated': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            emitSkillInvalidationCascade();
            return;
        }
        case 'skill.deleted': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            emitSkillInvalidationCascade();
            return;
        }
        case 'cron.updated':
        case 'cron.deleted': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            void syncAgentRuntimeCron().catch((error) => {
                console.warn('[tavern] failed to sync cron event', error);
            });
            emitCronUpdated();
            return;
        }
        case 'cron.runStarted':
        case 'cron.runFinished': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            void syncAgentRuntimeCron().catch((error) => {
                console.warn('[tavern] failed to sync cron run event', error);
            });
            emitCronUpdated();
            return;
        }
        case 'capability.updated': {
            emitObservedAgentRuntimeEvent(event);
            if (!connection) {
                emitAgentRuntimeUpdated();
                return;
            }

            void refreshRuntimeCapability(connection, event.capability).catch((error) => {
                console.warn('[tavern] failed to refresh runtime capability', error);
            });
            return;
        }
        case 'turn.progress': {
            markTurnSessionActive(event.turn.sessionKey);
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            return;
        }
        case 'turn.started': {
            markTurnSessionActive(event.turn.sessionKey);
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            return;
        }
        case 'turn.replyUpdated': {
            markTurnSessionActive(event.turn.sessionKey);
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            return;
        }
        case 'turn.completed':
        case 'turn.failed': {
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            clearTurnSessionActive(event.turn.sessionKey);
            emitSessionUpdated({ sessionKey: event.turn.sessionKey });
            emitChatLogUpdated({ sessionKey: event.turn.sessionKey });
            return;
        }
        case 'session.invalidated':
        case 'session.updated': {
            const sessionKey =
                event.type === 'session.updated' ? event.session.key : event.sessionKey;
            emitObservedAgentRuntimeEvent(event);
            debugTurnEvent(event);
            if (hasActiveTurnSession(sessionKey)) {
                emitWorkersUpdated();
                return;
            }
            emitWorkersUpdated();
            emitSessionUpdated({ sessionKey });
            emitChatLogUpdated({ sessionKey });
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

async function refreshRuntimeCapability(connection: RuntimeConnectionRecord, capability: string) {
    if (capability === 'gateway') {
        await refreshOpenClawGatewayCapability(connection.id);
        emitAgentRuntimeUpdated();
        return;
    }

    if (capability === 'tavernPlugin') {
        const client = createAgentRuntimeClientForConnection(connection);
        try {
            const status = await client.getStatus();
            await recordTavernPluginCapability({
                runtimeId: connection.id,
                status,
            });
        } finally {
            client.close();
        }
        emitAgentRuntimeUpdated();
        return;
    }

    emitAgentRuntimeUpdated();
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
    emitAgentRuntimeUpdated();
}

async function markConnectionReachable(connection: RuntimeConnectionRecord) {
    await markAgentRuntimeConnectionReachable({ connectionId: connection.id });
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
            void confirmAgentRuntimeConnection({ refreshCapabilities: false }).catch((error) => {
                console.warn('[tavern] failed to refresh runtime capabilities', error);
            });
            emitCronUpdated();
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
