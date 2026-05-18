import { activityStepFromProgressStep } from './tavern-api.js';

export function createTurnProgressProjector({ context, input, runId, startedAt }) {
    const labelsByStepId = new Map();
    const detailsByStepId = new Map();

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
            const projected = projectOpenClawProgressEvent({
                detailsByStepId,
                event,
                labelsByStepId,
            });

            if (projected) {
                void updateActivity(projected);
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

function projectOpenClawProgressEvent({ detailsByStepId, event, labelsByStepId }) {
    const data = event?.data && typeof event.data === 'object' ? event.data : {};

    if (event?.stream === 'tool') {
        return projectOpenClawToolEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'item') {
        return projectOpenClawItemEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'thinking') {
        return projectOpenClawThinkingEvent({ data, detailsByStepId });
    }

    if (event?.stream === 'command_output') {
        return projectOpenClawCommandOutputEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'plan') {
        return projectOpenClawPlanEvent({ data, detailsByStepId });
    }

    if (event?.stream === 'approval') {
        return projectOpenClawApprovalEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'patch') {
        return projectOpenClawPatchEvent({ data, detailsByStepId, labelsByStepId });
    }

    if (event?.stream === 'compaction') {
        return projectOpenClawCompactionEvent({ data });
    }

    return null;
}

function projectOpenClawToolEvent({ data, detailsByStepId, labelsByStepId }) {
    const name = readString(data.name);
    const id =
        readString(data.toolCallId) ?? readString(data.itemId) ?? (name ? `tool:${name}` : null);
    const phase = readString(data.phase);

    if (!(id && name && phase)) {
        return null;
    }

    const status = phase === 'result' ? resolveOpenClawToolResultStatus(data) : 'active';
    const label = resolveOpenClawProgressLabel({ data, id, labelsByStepId, name });
    const detail = readString(data.summary) ?? readString(data.progressText) ?? null;

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail: detail ?? detailsByStepId.get(id) ?? null,
        id,
        kind: 'tool',
        label,
        status,
    };
}

function projectOpenClawItemEvent({ data, detailsByStepId, labelsByStepId }) {
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

    const label = readString(data.title) ?? readString(data.name) ?? labelsByStepId.get(id);

    if (!label) {
        return null;
    }

    labelsByStepId.set(id, label);

    const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind,
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function projectOpenClawThinkingEvent({ data, detailsByStepId }) {
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

function projectOpenClawCommandOutputEvent({ data, detailsByStepId, labelsByStepId }) {
    const id =
        readString(data.itemId) ??
        (readString(data.toolCallId) ? `command:${readString(data.toolCallId)}` : null);

    if (!id) {
        return null;
    }

    const label =
        readString(data.title) ??
        labelsByStepId.get(id) ??
        buildOpenClawToolLabel({
            args: { command: readString(data.output) ?? readString(data.name) },
            name: readString(data.name) ?? 'command',
        });
    const detail = readString(data.output) ?? detailsByStepId.get(id) ?? null;

    labelsByStepId.set(id, label);

    if (detail) {
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind: 'command',
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function projectOpenClawPlanEvent({ data, detailsByStepId }) {
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

function projectOpenClawApprovalEvent({ data, detailsByStepId, labelsByStepId }) {
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
        kind: 'command',
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function projectOpenClawPatchEvent({ data, detailsByStepId, labelsByStepId }) {
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
        kind: 'tool',
        label,
        status: resolveOpenClawProgressStatus(data),
    };
}

function projectOpenClawCompactionEvent({ data }) {
    return {
        detail: null,
        id: 'compaction',
        kind: 'plan',
        label: 'Compaction',
        status:
            data.completed === true || readString(data.phase) === 'end' ? 'completed' : 'active',
    };
}

function resolveOpenClawProgressLabel({ data, id, labelsByStepId, name }) {
    const existing = labelsByStepId.get(id);

    if (existing) {
        return existing;
    }

    const label = readString(data.title) ?? buildOpenClawToolLabel({ args: data.args, name });
    labelsByStepId.set(id, label);

    return label;
}

function buildOpenClawToolLabel({ args, name }) {
    const formattedName = formatToolName(name);
    const target = readToolTarget(args);

    return target ? `${formattedName} ${target}` : formattedName;
}

function readToolTarget(args) {
    if (!args || typeof args !== 'object') {
        return null;
    }

    return (
        readString(args.path) ??
        readString(args.file_path) ??
        readString(args.command) ??
        readString(args.cmd) ??
        readString(args.query) ??
        readString(args.task) ??
        readString(args.message)
    );
}

function formatToolName(name) {
    return name.replace(/[_-]+/g, ' ').trim() || 'tool';
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
    return ['command', 'message', 'plan', 'reasoning', 'tool'].includes(value) ? value : null;
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
