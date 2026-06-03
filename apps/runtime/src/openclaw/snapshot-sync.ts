import { type AgentRuntimeSession, agentRuntimeSessionPreviewListSchema } from '@tavern/api';
import { mapOpenClawChatsFromSessions } from '@tavern/openclaw-gateway-adapter';
import { log } from '../log';
import { replaceStoredAgents } from '../tavern/agents-store';
import {
    replaceStoredOpenClawSessionGraphs,
    replaceStoredOpenClawSessionMessages,
    replaceStoredOpenClawSessions,
} from '../tavern/openclaw-sessions-store';
import {
    getStoredOpenClawModelsSnapshotStatus,
    getStoredOpenClawSkillsSnapshotStatus,
    replaceStoredOpenClawChats,
    replaceStoredOpenClawModels,
    replaceStoredOpenClawSkills,
} from '../tavern/openclaw-snapshots-store';
import { publishRuntimeEvent } from '../tavern/runtime-events';
import { createLocalOpenClawClient } from './local-client';
import { getManagedOpenClawState } from './state';

const referenceSnapshotMaxAgeMs = 60_000;
let modelRefreshPromise: Promise<unknown> | null = null;
let skillRefreshPromise: Promise<unknown> | null = null;

export async function syncManagedOpenClawAgents(options?: { publishEvents?: boolean }) {
    const client = createLocalOpenClawClient();
    const publishEvents = options?.publishEvents ?? true;

    try {
        const agents = (await client.listAgents()).agents;
        const result = replaceStoredAgents({ agents });
        if (publishEvents) {
            publishAgentUpdatedEvents(result.changedAgentIds);
        }
        return result;
    } finally {
        client.close();
    }
}

export async function syncManagedOpenClawSnapshots(options?: { publishEvents?: boolean }) {
    const client = createLocalOpenClawClient();
    const publishEvents = options?.publishEvents ?? true;

    try {
        const [agents, models, skills] = await Promise.allSettled([
            client.listAgents(),
            client.getModels(),
            client.listSkills(),
        ]);

        const agentResult =
            agents.status === 'fulfilled'
                ? replaceStoredAgents({ agents: agents.value.agents })
                : { changedAgentIds: [], synced: 0 };
        const modelResult =
            models.status === 'fulfilled'
                ? replaceStoredOpenClawModels({ models: models.value })
                : { changed: false, synced: 0 };
        const skillResult =
            skills.status === 'fulfilled'
                ? replaceStoredOpenClawSkills({
                      skills: skills.value.skills,
                  })
                : { changedSkillIds: [], synced: 0 };

        if (agents.status === 'rejected') {
            log.warn('Managed OpenClaw agent snapshot sync failed', { error: agents.reason });
        }
        if (models.status === 'rejected') {
            log.warn('Managed OpenClaw model snapshot sync failed', { error: models.reason });
        }
        if (skills.status === 'rejected') {
            log.warn('Managed OpenClaw skill snapshot sync failed', { error: skills.reason });
        }

        if (publishEvents) {
            publishAgentUpdatedEvents(agentResult.changedAgentIds);
            if (modelResult.changed) {
                publishModelUpdatedEvent();
            }
            publishSkillUpdatedEvents(skillResult.changedSkillIds);
        }

        return {
            agents: agentResult.synced,
            chats: 0,
            models: modelResult.synced,
            sessionGraphs: 0,
            sessionMessages: 0,
            sessions: 0,
            skills: skillResult.synced,
        };
    } finally {
        client.close();
    }
}

export async function syncManagedOpenClawSessions() {
    const client = createLocalOpenClawClient();

    try {
        const sessions = await client.listSessions();
        const sessionResult = replaceStoredOpenClawSessions({ sessions: sessions.sessions });
        const chatResult = replaceStoredOpenClawChats({
            chats: mapOpenClawChatsFromSessions(sessions).chats,
        });

        return {
            chats: chatResult.synced,
            sessionGraphs: 0,
            sessionMessages: 0,
            sessions: sessionResult.synced,
        };
    } finally {
        client.close();
    }
}

export async function syncManagedOpenClawSessionDetails(
    sessionKey: string,
    options: { session?: AgentRuntimeSession } = {}
) {
    const client = createLocalOpenClawClient();

    try {
        const sessionDetails = await syncSessionDetailsByKey(client, sessionKey);
        const sessionResult = options.session
            ? replaceStoredOpenClawSessions({
                  pruneMissing: false,
                  sessions: [options.session],
              })
            : { synced: 0 };

        return {
            sessionGraphs: sessionDetails.graphs,
            sessionMessages: sessionDetails.messages,
            sessions: sessionResult.synced + sessionDetails.sessions,
        };
    } finally {
        client.close();
    }
}

export function recordManagedOpenClawSessionUpdate(session: AgentRuntimeSession) {
    const sessionResult = replaceStoredOpenClawSessions({
        pruneMissing: false,
        sessions: [session],
    });
    const chatResult = replaceStoredOpenClawChats({
        chats: mapOpenClawChatsFromSessions({ sessions: [session] }).chats,
        pruneMissing: false,
    });

    return {
        chats: chatResult.synced,
        sessions: sessionResult.synced,
    };
}

export async function previewManagedOpenClawSessions(input: {
    keys: string[];
    limit?: number;
    maxChars?: number;
}) {
    const keys = [...new Set(input.keys.map((key) => key.trim()).filter(Boolean))].slice(0, 64);

    if (keys.length === 0 || !getManagedOpenClawState().gatewayReady) {
        return agentRuntimeSessionPreviewListSchema.parse({
            previews: keys.map((key) => ({ items: [], key, status: 'missing' })),
            ts: Date.now(),
        });
    }

    const client = createLocalOpenClawClient();

    try {
        return await client.listSessionPreviews({
            keys,
            limit: input.limit,
            maxChars: input.maxChars,
        });
    } finally {
        client.close();
    }
}

async function syncSessionDetailsByKey(
    client: ReturnType<typeof createLocalOpenClawClient>,
    sessionKey: string
) {
    const graph = await client.getSessionGraph(sessionKey).catch((error) => {
        log.warn('Managed OpenClaw session graph sync failed', {
            error,
            sessionKey,
        });
        return null;
    });

    if (graph) {
        const sessionResult = replaceStoredOpenClawSessions({
            pruneMissing: false,
            sessions: graph.sessions,
        });
        replaceStoredOpenClawChats({
            chats: mapOpenClawChatsFromSessions({ sessions: graph.sessions }).chats,
            pruneMissing: false,
        });
        const messageResult = replaceStoredOpenClawSessionMessages({
            messagesBySessionKey: new Map([[sessionKey, graph.messages]]),
        });
        const graphResult = replaceStoredOpenClawSessionGraphs({ graphs: [graph] });

        return {
            graphs: graphResult.synced,
            messages: messageResult.synced,
            sessions: sessionResult.synced,
        };
    }

    const messages = await client.listSessionMessages(sessionKey, { limit: 200 }).catch((error) => {
        log.warn('Managed OpenClaw session message sync failed', {
            error,
            sessionKey,
        });
        return null;
    });
    if (!messages) {
        return {
            graphs: 0,
            messages: 0,
            sessions: 0,
        };
    }

    const messageResult = replaceStoredOpenClawSessionMessages({
        messagesBySessionKey: new Map([[sessionKey, messages.messages]]),
    });

    return {
        graphs: 0,
        messages: messageResult.synced,
        sessions: 0,
    };
}

export async function syncManagedOpenClawModels(options?: { publishEvents?: boolean }) {
    const client = createLocalOpenClawClient();
    const publishEvents = options?.publishEvents ?? true;

    try {
        const models = await client.getModels();
        const result = replaceStoredOpenClawModels({ models });

        if (publishEvents && result.changed) {
            publishModelUpdatedEvent();
        }

        return result;
    } finally {
        client.close();
    }
}

export async function syncManagedOpenClawSkills(options?: { publishEvents?: boolean }) {
    const client = createLocalOpenClawClient();
    const publishEvents = options?.publishEvents ?? true;

    try {
        const skills = await client.listSkills();
        const result = replaceStoredOpenClawSkills({
            skills: skills.skills,
        });

        if (publishEvents) {
            publishSkillUpdatedEvents(result.changedSkillIds);
        }

        return result;
    } finally {
        client.close();
    }
}

export function refreshManagedOpenClawModelsInBackground(reason: string) {
    if (!shouldRefreshReferenceSnapshot(getStoredOpenClawModelsSnapshotStatus())) {
        return;
    }

    if (modelRefreshPromise || !getManagedOpenClawState().gatewayReady) {
        return;
    }

    modelRefreshPromise = syncManagedOpenClawModels()
        .catch((error) => {
            log.warn('Managed OpenClaw models refresh failed', { error, reason });
        })
        .finally(() => {
            modelRefreshPromise = null;
        });
}

export function refreshManagedOpenClawSkillsInBackground(reason: string) {
    if (!shouldRefreshReferenceSnapshot(getStoredOpenClawSkillsSnapshotStatus())) {
        return;
    }

    if (skillRefreshPromise || !getManagedOpenClawState().gatewayReady) {
        return;
    }

    skillRefreshPromise = syncManagedOpenClawSkills()
        .catch((error) => {
            log.warn('Managed OpenClaw skills refresh failed', { error, reason });
        })
        .finally(() => {
            skillRefreshPromise = null;
        });
}

export function syncManagedOpenClawSnapshotsInBackground(reason: string) {
    return syncManagedOpenClawSnapshots().catch((error) => {
        log.warn('Managed OpenClaw snapshot sync failed', { error, reason });
    });
}

function publishAgentUpdatedEvents(agentIds: string[]) {
    for (const agentId of agentIds) {
        publishRuntimeEvent({
            agentId,
            timestamp: new Date().toISOString(),
            type: 'agent.updated',
        });
    }
}

function publishModelUpdatedEvent() {
    publishRuntimeEvent({
        timestamp: new Date().toISOString(),
        type: 'model.updated',
    });
}

function publishSkillUpdatedEvents(skillIds: string[]) {
    for (const skillId of skillIds) {
        publishRuntimeEvent({
            skillId,
            timestamp: new Date().toISOString(),
            type: 'skill.updated',
        });
    }
}

function shouldRefreshReferenceSnapshot(input: {
    hasSnapshot: boolean;
    lastSyncedAt: null | string;
}) {
    if (!(input.hasSnapshot && input.lastSyncedAt)) {
        return true;
    }

    const lastSyncedAt = Date.parse(input.lastSyncedAt);
    return !Number.isFinite(lastSyncedAt) || Date.now() - lastSyncedAt > referenceSnapshotMaxAgeMs;
}
