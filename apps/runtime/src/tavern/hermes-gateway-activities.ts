import { getResponseActivity, upsertResponseActivity } from './chat-api';

// Durable activity recording for gateway events that are not tool calls or
// reasoning: agent notices (notification.show/clear), spawn-tree progress
// (subagent.*), and tool-approval prompts (approval.request). The recorder
// projects Tavern primitives plus source facts; final presentation belongs
// to the server projection and the app.

export interface GatewayActivityContext {
    agentId: string;
    chatId: string;
    responseId: string;
    runId: string;
    sessionKey: string;
}

interface OpenNotice {
    detail: string;
    id: string;
    metadata: Record<string, unknown>;
    title: string;
}

interface OpenApproval {
    detail: string | null;
    id: string;
    metadata: Record<string, unknown>;
}

export function createGatewayActivityRecorder(context: GatewayActivityContext) {
    const openNotices = new Map<string, OpenNotice>();
    const openApprovals: OpenApproval[] = [];
    let approvalIndex = 0;
    const settleOldestApproval = () => {
        const approval = openApprovals.shift();

        if (!approval) {
            return;
        }

        upsertResponseActivity(context.chatId, context.responseId, {
            completed_at: new Date().toISOString(),
            detail: approval.detail,
            id: approval.id,
            kind: 'approval',
            metadata: { ...approval.metadata, event: 'approval.settled' },
            status: 'completed',
            title: 'Approval',
        });
    };

    return {
        clearNotice(data: Record<string, unknown>) {
            const key = readString(data.key);
            const notice = key ? openNotices.get(key) : undefined;

            if (!(key && notice)) {
                return;
            }

            openNotices.delete(key);
            upsertResponseActivity(context.chatId, context.responseId, {
                completed_at: new Date().toISOString(),
                detail: notice.detail,
                id: notice.id,
                kind: 'custom',
                metadata: { ...notice.metadata, event: 'notification.clear' },
                status: 'completed',
                title: notice.title,
            });
        },

        hasOpenApproval() {
            return openApprovals.length > 0;
        },

        recordApproval(data: Record<string, unknown>) {
            const command = readString(data.command);
            const description = readString(data.description);
            const patternKey = readString(data.pattern_key);
            approvalIndex += 1;
            const id = activityId(context.runId, `approval_${approvalIndex}`);
            const detail = description ?? command;
            const metadata = {
                approval: {
                    command,
                    description,
                    patternKey,
                    patternKeys: readStringArray(data.pattern_keys),
                },
                event: 'approval.request',
                runtime: { ...runtimeMetadata(context), toolName: 'approval' },
                tool: {
                    arguments: { command, description },
                    name: 'approval',
                    result: null,
                },
            };

            openApprovals.push({ detail, id, metadata });
            upsertResponseActivity(context.chatId, context.responseId, {
                detail,
                id,
                kind: 'approval',
                metadata,
                status: 'running',
                title: 'Approval',
            });
        },

        recordNotice(data: Record<string, unknown>) {
            const text = readString(data.text);

            if (!text) {
                return;
            }

            const key = readString(data.key) ?? readString(data.id) ?? stableSuffix(text);
            const id = activityId(context.runId, `notice_${stableSuffix(key)}`);
            const title = 'Agent notice';
            const metadata = {
                event: 'notification.show',
                runtime: {
                    ...runtimeMetadata(context),
                    notice: {
                        detail: null,
                        id: readString(data.id),
                        kind: 'status',
                        level: readString(data.level),
                        sessionId: null,
                        sourceKind: readString(data.kind),
                        text,
                        title,
                        ttlMs: readNumber(data.ttl_ms),
                    },
                },
            };

            openNotices.set(key, { detail: text, id, metadata, title });
            upsertResponseActivity(context.chatId, context.responseId, {
                detail: text,
                id,
                kind: 'custom',
                metadata,
                status: 'running',
                title,
            });
        },

        // Spawn-tree progress. Requires the gateway's stable subagent id —
        // events without one fail the mapping instead of inventing identity.
        recordWorker(data: Record<string, unknown>) {
            const subagentId = readString(data.subagent_id);

            if (!subagentId) {
                warnMissingSubagentId();
                return;
            }

            const sourceEvent = readString(data.source_event) ?? 'subagent.progress';
            const isTerminal = sourceEvent === 'subagent.complete';
            const sourceStatus = readString(data.status);
            const failed = sourceStatus === 'failed' || sourceStatus === 'error';
            const summary = readString(data.summary);
            const goal = readString(data.goal);
            const id = activityId(context.runId, `subagent_${subagentId}`);
            const existing = getResponseActivity(id);
            const previousSubagent = readRecord(existing?.metadata.subagent);
            const nextSubagent = { ...previousSubagent, ...subagentFacts(data, subagentId) };

            upsertResponseActivity(context.chatId, context.responseId, {
                ...(isTerminal ? { completed_at: new Date().toISOString() } : {}),
                detail: summary ?? readString(data.text) ?? existing?.detail,
                id,
                kind: 'custom',
                metadata: {
                    event: sourceEvent,
                    runtime: runtimeMetadata(context),
                    subagent: nextSubagent,
                },
                status: isTerminal ? (failed ? 'failed' : 'completed') : 'running',
                title: goal ?? existing?.title ?? 'Worker task',
            });
        },

        // The gateway emits no approval-resolution event; the agent simply
        // resumes. The first resumed-stream event settles the oldest pending
        // approval, matching the gateway's FIFO resolution order.
        settleOldestApproval() {
            settleOldestApproval();
        },

        settleOpenApprovals() {
            while (openApprovals.length > 0) {
                settleOldestApproval();
            }
        },
    };
}

function subagentFacts(data: Record<string, unknown>, subagentId: string) {
    return compact({
        apiCalls: readNumber(data.api_calls),
        costUsd: readNumber(data.cost_usd),
        depth: readNumber(data.depth),
        durationSeconds: readNumber(data.duration_seconds),
        filesRead: readStringArray(data.files_read),
        filesWritten: readStringArray(data.files_written),
        goal: readString(data.goal),
        inputTokens: readNumber(data.input_tokens),
        model: readString(data.model),
        outputTokens: readNumber(data.output_tokens),
        parentId: readString(data.parent_id),
        reasoningTokens: readNumber(data.reasoning_tokens),
        status: readString(data.status),
        subagentId,
        summary: readString(data.summary),
        taskCount: readNumber(data.task_count),
        taskIndex: readNumber(data.task_index),
        toolCount: readNumber(data.tool_count),
        toolName: readString(data.tool_name),
        toolPreview: readString(data.tool_preview),
        toolsets: readStringArray(data.toolsets),
    });
}

function runtimeMetadata(context: GatewayActivityContext) {
    return {
        agentId: context.agentId,
        runId: context.runId,
        sessionKey: context.sessionKey,
        source: 'hermes',
    };
}

function activityId(runId: string, key: string) {
    return `act_${`${runId}_${key}`.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

function stableSuffix(value: string) {
    let hash = 5381;
    for (const character of value) {
        hash = (hash * 33) ^ character.charCodeAt(0);
    }
    return Math.abs(hash >>> 0).toString(36);
}

function compact(record: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(record).filter(([, value]) => value !== null && value !== undefined)
    );
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }

    const items = value.filter((item): item is string => typeof item === 'string');
    return items.length > 0 ? items : null;
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

let warnedMissingSubagentId = false;

function warnMissingSubagentId() {
    if (warnedMissingSubagentId) {
        return;
    }

    warnedMissingSubagentId = true;
    console.warn('[tavern-runtime] Dropped a subagent gateway event without a stable subagent_id.');
}
