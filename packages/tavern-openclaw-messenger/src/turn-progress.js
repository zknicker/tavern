import { activityStepFromProgressStep } from './tavern-api.js';

export function createTurnProgressMapper({ context, input, runId, startedAt }) {
    const labelsByStepId = new Map();
    const detailsByStepId = new Map();
    const toolArgumentsByStepId = new Map();
    const toolNamesByStepId = new Map();

    const updateActivity = (step) => {
        const timestamp = new Date().toISOString();

        return requireTavernApi(context).updateTurnActivity(
            {
                agentId: input.agentId,
                chatId: input.chatId,
                messageId: input.messageId,
                runId,
                sessionKey: input.sessionKey,
                startedAt,
            },
            {
                status: 'running',
                step: activityStepFromProgressStep(step, timestamp),
            }
        );
    };

    return {
        handle(event) {
            const mapped = mapOpenClawProgressEvent({
                detailsByStepId,
                event,
                labelsByStepId,
                toolArgumentsByStepId,
                toolNamesByStepId,
            });

            if (mapped) {
                void updateActivity(mapped);
            }
        },
    };
}

function requireTavernApi(context) {
    if (!context?.tavern) {
        throw new Error('Tavern Messenger requires a Tavern API client.');
    }
    return context.tavern;
}

function mapOpenClawProgressEvent({
    detailsByStepId,
    event,
    labelsByStepId,
    toolArgumentsByStepId,
    toolNamesByStepId,
}) {
    const data = event?.data && typeof event.data === 'object' ? event.data : {};

    if (event?.stream === 'tool_result') {
        return mapOpenClawToolResultEvent({
            data,
            detailsByStepId,
            labelsByStepId,
            toolArgumentsByStepId,
            toolNamesByStepId,
        });
    }

    if (event?.stream === 'item') {
        return mapOpenClawItemEvent({
            data,
            detailsByStepId,
            labelsByStepId,
            toolArgumentsByStepId,
            toolNamesByStepId,
        });
    }

    if (event?.stream === 'thinking') {
        return mapOpenClawThinkingEvent({ data, detailsByStepId });
    }

    if (event?.stream === 'command_output') {
        return mapOpenClawCommandOutputEvent({
            data,
            detailsByStepId,
            labelsByStepId,
            toolArgumentsByStepId,
            toolNamesByStepId,
        });
    }

    if (event?.stream === 'plan') {
        return mapOpenClawPlanEvent({ data, detailsByStepId });
    }

    if (event?.stream === 'approval') {
        return mapOpenClawApprovalEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'patch') {
        return mapOpenClawPatchEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'compaction') {
        return mapOpenClawCompactionEvent({ data });
    }

    return null;
}

function mapOpenClawItemEvent({
    data,
    detailsByStepId,
    labelsByStepId,
    toolArgumentsByStepId,
    toolNamesByStepId,
}) {
    const kind = readOpenClawItemKind(data.kind) ?? readOpenClawItemKind(data.type);
    const id = readString(data.toolCallId) ?? readString(data.itemId) ?? readString(data.id);

    if (!(id && kind)) {
        return null;
    }

    if (kind === 'reasoning') {
        const detail = readProgressDetail(data) ?? detailsByStepId.get('reasoning') ?? null;

        if (!detail) {
            return null;
        }

        detailsByStepId.set('reasoning', detail);

        return {
            detail,
            id: 'reasoning',
            kind: 'reasoning',
            label: 'Reasoning',
            status: resolveOpenClawProgressStatus(data),
        };
    }

    if (kind === 'preamble') {
        const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;

        if (!detail) {
            return null;
        }

        detailsByStepId.set(id, detail);

        return {
            detail,
            id,
            kind: 'message',
            label: 'Assistant reply',
            status: resolveOpenClawProgressStatus(data),
        };
    }

    if (kind === 'command') {
        return mapOpenClawCommandItemEvent({
            data,
            detailsByStepId,
            id,
            labelsByStepId,
            toolArgumentsByStepId,
            toolNamesByStepId,
        });
    }

    const label = readString(data.title) ?? readString(data.name) ?? labelsByStepId.get(id);

    if (!label) {
        return null;
    }

    labelsByStepId.set(id, label);
    const toolName = kind === 'tool' ? readString(data.name) : null;
    if (toolName) {
        toolNamesByStepId.set(id, toolName);
    }

    const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind,
        label,
        arguments: kind === 'tool' ? (toolArgumentsByStepId.get(id) ?? null) : null,
        status: resolveOpenClawProgressStatus(data),
        toolName,
    };
}

function mapOpenClawCommandItemEvent({
    data,
    detailsByStepId,
    id,
    labelsByStepId,
    toolArgumentsByStepId,
    toolNamesByStepId,
}) {
    const toolName = readString(data.name) ?? 'command';
    const toolCallId = readToolCallId(data);
    const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;
    const label = resolveOpenClawCommandItemLabel({
        data,
        id,
        labelsByStepId,
        toolName,
    });

    if (detail) {
        detailsByStepId.set(id, detail);
    }
    toolNamesByStepId.set(id, toolName);

    return {
        arguments: toolArgumentsByStepId.get(id) ?? null,
        detail,
        id,
        kind: 'tool',
        label,
        status: resolveOpenClawProgressStatus(data),
        toolCallId,
        toolName,
    };
}

function mapOpenClawToolResultEvent({
    data,
    detailsByStepId,
    labelsByStepId,
    toolArgumentsByStepId,
    toolNamesByStepId,
}) {
    const id = readString(data.itemId) ?? readString(data.toolCallId) ?? readString(data.id);

    if (!id) {
        return null;
    }

    const label = labelsByStepId.get(id);
    const toolName = toolNamesByStepId.get(id);

    if (!(label && toolName)) {
        return null;
    }

    const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        arguments: toolArgumentsByStepId.get(id) ?? null,
        detail,
        id,
        kind: 'tool',
        label,
        result: readProgressDetail(data) ?? null,
        status: data.isError === true ? 'failed' : 'completed',
        toolName,
    };
}

function mapOpenClawThinkingEvent({ data, detailsByStepId }) {
    const detail = readProgressDetail(data);

    if (!detail) {
        return null;
    }

    const id = 'reasoning';
    const existingDetail = detailsByStepId.get(id);
    const nextDetail = readString(data.delta) && existingDetail ? existingDetail + detail : detail;
    detailsByStepId.set(id, nextDetail);

    return {
        detail: nextDetail,
        id,
        kind: 'reasoning',
        label: 'Reasoning',
        status: resolveOpenClawProgressStatus(data),
    };
}

function readProgressDetail(data) {
    return (
        readString(data.text) ??
        readString(data.delta) ??
        readString(data.summary) ??
        readSummaryText(data.summary) ??
        readString(data.progressText) ??
        readString(data.content) ??
        readString(data.message)
    );
}

function mapOpenClawCommandOutputEvent({
    data,
    detailsByStepId,
    labelsByStepId,
    toolArgumentsByStepId,
    toolNamesByStepId,
}) {
    const id = readString(data.itemId) ?? readString(data.toolCallId) ?? readString(data.id);

    if (!id) {
        return null;
    }

    const label = labelsByStepId.get(id);

    if (!label) {
        return null;
    }

    const detail = readString(data.output) ?? detailsByStepId.get(id) ?? null;
    const toolName = readString(data.name);

    if (toolName) {
        toolNamesByStepId.set(id, toolName);
    }

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        arguments: toolArgumentsByStepId.get(id) ?? null,
        detail,
        id,
        kind: 'tool',
        label,
        result: buildCommandOutputResult(data),
        status: resolveOpenClawProgressStatus(data),
        toolCallId: readToolCallId(data),
        toolName: toolNamesByStepId.get(id) ?? toolName ?? null,
    };
}

function mapOpenClawPlanEvent({ data, detailsByStepId }) {
    const id = 'plan';
    const title = readString(data.title) ?? 'Plan';
    const detail =
        readString(data.explanation) ?? joinStrings(data.steps) ?? detailsByStepId.get(id) ?? null;

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind: 'plan',
        label: title,
        status: resolveOpenClawProgressStatus(data),
    };
}

function mapOpenClawApprovalEvent({ data, detailsByStepId, labelsByStepId }) {
    const id = readString(data.itemId) ?? readString(data.toolCallId) ?? 'approval';
    const label =
        readString(data.title) ??
        labelsByStepId.get(id) ??
        (readString(data.command) ? `approval ${readString(data.command)}` : 'Approval');
    const detail =
        readString(data.message) ??
        readString(data.reason) ??
        readString(data.command) ??
        detailsByStepId.get(id) ??
        null;

    labelsByStepId.set(id, label);

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind: 'approval',
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function mapOpenClawPatchEvent({ data, detailsByStepId, labelsByStepId }) {
    const id = readString(data.itemId) ?? readString(data.toolCallId) ?? 'patch';
    const label = readString(data.title) ?? labelsByStepId.get(id) ?? 'Patch';
    const files = [
        ...readStringArray(data.added).map((entry) => `added ${entry}`),
        ...readStringArray(data.modified).map((entry) => `modified ${entry}`),
        ...readStringArray(data.deleted).map((entry) => `deleted ${entry}`),
    ];
    const detail = readString(data.summary) ?? joinStrings(files) ?? null;

    labelsByStepId.set(id, label);

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail: detail ?? detailsByStepId.get(id) ?? null,
        id,
        kind: 'artifact',
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function mapOpenClawCompactionEvent({ data }) {
    return {
        detail: null,
        id: 'compaction',
        kind: 'plan',
        label: 'Compaction',
        status:
            data.completed === true || readString(data.phase) === 'end' ? 'completed' : 'active',
    };
}

function resolveOpenClawCommandItemLabel({ data, id, labelsByStepId, toolName }) {
    const existing = labelsByStepId.get(id);

    if (existing && existing !== 'Command') {
        return existing;
    }

    const target = readString(data.meta) ?? readString(data.summary) ?? readString(data.progressText);
    const label = target ? `${formatToolName(toolName)} ${target}` : formatToolName(toolName);

    labelsByStepId.set(id, label);

    return label;
}

function formatToolName(name) {
    return name.replace(/[_-]+/g, ' ').trim() || 'tool';
}

function readToolCallId(data) {
    return (
        readString(data.toolCallId) ??
        readString(data.callId) ??
        readLikelyToolCallId(data.itemId) ??
        readLikelyToolCallId(data.id)
    );
}

function readLikelyToolCallId(value) {
    const text = readString(value);
    return text?.startsWith('call_') ? text : null;
}

function buildCommandOutputResult(data) {
    return {
        cwd: readString(data.cwd),
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
        exitCode: typeof data.exitCode === 'number' || data.exitCode === null ? data.exitCode : null,
        output: readString(data.output),
        status: readString(data.status),
    };
}

function resolveOpenClawToolResultStatus(data) {
    if (data.isError === true) {
        return 'failed';
    }

    return 'completed';
}

function resolveOpenClawProgressStatus(data) {
    const status = readString(data.status)?.toLowerCase();
    const phase = readString(data.phase)?.toLowerCase();

    if (status && /\b(?:error|failed|failure)\b/u.test(status)) {
        return 'failed';
    }

    if (status === 'denied' || status === 'blocked' || status === 'unavailable') {
        return 'failed';
    }

    if (status === 'completed' || status === 'complete' || phase === 'end') {
        return 'completed';
    }

    if (phase === 'result') {
        return resolveOpenClawToolResultStatus(data);
    }

    return 'active';
}

function readOpenClawItemKind(value) {
    return [
        'approval',
        'artifact',
        'command',
        'message',
        'plan',
        'preamble',
        'reasoning',
        'tool',
    ].includes(value)
        ? value
        : null;
}

function readString(value) {
    return typeof value === 'string' && value.trim() ? value : null;
}

function readStringArray(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function readSummaryText(value) {
    if (!Array.isArray(value)) {
        return null;
    }

    const text = value
        .map((entry) => {
            if (typeof entry === 'string') {
                return entry;
            }
            if (entry && typeof entry === 'object') {
                return readString(entry.text);
            }
            return null;
        })
        .filter((entry) => entry?.trim())
        .join('\n');

    return text.length > 0 ? text : null;
}

function joinStrings(value) {
    const text = readStringArray(value)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join('\n');

    return text.length > 0 ? text : null;
}
