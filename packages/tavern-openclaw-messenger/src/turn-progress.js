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

    if (event?.stream === 'partial_reply') {
        return null;
    }

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
    const openClawKind = readString(data.kind) ?? readString(data.type);
    const kind = readOpenClawItemKind(openClawKind) ?? (openClawKind ? 'custom' : null);
    const toolIdentity =
        kind === 'command' || kind === 'tool' ? readOpenClawToolIdentity(data) : null;
    const id =
        toolIdentity?.toolCallId ??
        readString(data.toolCallId) ??
        readString(data.itemId) ??
        readString(data.id);

    if (!(id && kind)) {
        return null;
    }

    // Codex emits completed raw-assistant preamble mirrors after streaming the
    // same visible commentary through a msg_... preamble item. The msg_... item
    // is the live activity identity; raw echoes would duplicate the timeline.
    if (kind === 'preamble' && isRawAssistantItemId(id)) {
        return null;
    }

    if ((kind === 'command' || kind === 'tool') && !toolIdentity?.toolCallId) {
        return null;
    }

    if (kind === 'message' && isRawAssistantItemId(id)) {
        return null;
    }

    if (kind === 'reasoning' || kind === 'analysis') {
        const detail = readProgressDetail(data) ?? detailsByStepId.get(id) ?? null;
        const label = readString(data.title) ?? labelsByStepId.get(id) ?? 'Reasoning';

        if (!detail) {
            return null;
        }

        labelsByStepId.set(id, label);
        detailsByStepId.set(id, detail);
        return {
            detail,
            id,
            kind: 'reasoning',
            label,
            metadata: buildOpenClawItemMetadata(openClawKind),
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
            metadata: buildOpenClawItemMetadata(openClawKind),
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

    if (kind === 'patch') {
        return mapOpenClawPatchEvent({ data, detailsByStepId, labelsByStepId });
    }

    const label =
        readString(data.title) ??
        readString(data.name) ??
        labelsByStepId.get(id) ??
        (kind === 'custom' ? openClawKind : null);

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
        if (kind === 'message' && detailsByStepId.get(id) === detail) {
            return null;
        }
        detailsByStepId.set(id, detail);
    }

    return {
        detail,
        id,
        kind: kind === 'custom' ? 'custom' : kind,
        label,
        arguments: kind === 'tool' ? (toolArgumentsByStepId.get(id) ?? null) : null,
        metadata: buildOpenClawItemMetadata(openClawKind),
        status: resolveOpenClawProgressStatus(data),
        rawOpenClawIds: kind === 'tool' ? toolIdentity.rawIds : null,
        toolCallId: kind === 'tool' ? toolIdentity.toolCallId : null,
        toolName,
    };
}

function buildOpenClawItemMetadata(openClawKind) {
    return openClawKind
        ? {
              runtime: {
                  openClawKind,
              },
          }
        : null;
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
    const toolIdentity = readOpenClawToolIdentity(data);

    if (!toolIdentity?.toolCallId) {
        return null;
    }

    const toolCallId = toolIdentity.toolCallId;
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
        rawOpenClawIds: toolIdentity.rawIds,
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
    const toolIdentity = readOpenClawToolIdentity(data);
    const id = toolIdentity?.toolCallId;

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
        rawOpenClawIds: toolIdentity.rawIds,
        result: readProgressDetail(data) ?? null,
        status: data.isError === true ? 'failed' : 'completed',
        toolCallId: toolIdentity.toolCallId,
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
    const toolIdentity = readOpenClawToolIdentity(data);
    const id = toolIdentity?.toolCallId;

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
        rawOpenClawIds: toolIdentity.rawIds,
        result: buildCommandOutputResult(data),
        status: resolveOpenClawProgressStatus(data),
        toolCallId: toolIdentity.toolCallId,
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

    const target =
        readString(data.meta) ?? readString(data.summary) ?? readString(data.progressText);
    const label = target ? `${formatToolName(toolName)} ${target}` : formatToolName(toolName);

    labelsByStepId.set(id, label);

    return label;
}

function formatToolName(name) {
    return name.replace(/[_-]+/g, ' ').trim() || 'tool';
}

function readOpenClawToolIdentity(data) {
    const directToolCallId = readLikelyToolCallId(data.toolCallId);
    const directCallId = readLikelyToolCallId(data.callId);
    const itemId = readString(data.itemId);
    const id = readString(data.id);
    const parsedItem = parseOpenClawToolWrapperId(itemId);
    const parsedId = parseOpenClawToolWrapperId(id);
    const toolCallId =
        directToolCallId ??
        directCallId ??
        parsedItem?.toolCallId ??
        parsedId?.toolCallId ??
        readLikelyToolCallId(itemId) ??
        readLikelyToolCallId(id);

    if (!toolCallId) {
        return null;
    }

    return {
        providerItemId: parsedItem?.providerItemId ?? parsedId?.providerItemId ?? null,
        rawIds: {
            callId: readString(data.callId),
            id,
            itemId,
            providerItemId: parsedItem?.providerItemId ?? parsedId?.providerItemId ?? null,
            toolCallId: readString(data.toolCallId),
        },
        toolCallId,
    };
}

function parseOpenClawToolWrapperId(value) {
    const text = readString(value);

    if (!text?.startsWith('tool:')) {
        return null;
    }

    const [toolCallId, providerItemId = null] = text.slice('tool:'.length).split('|');
    const normalizedToolCallId = readLikelyToolCallId(toolCallId);

    if (!normalizedToolCallId) {
        return null;
    }

    return {
        providerItemId: readString(providerItemId),
        toolCallId: normalizedToolCallId,
    };
}

function readLikelyToolCallId(value) {
    const text = readString(value);
    return text?.startsWith('call_') ? text : null;
}

function buildCommandOutputResult(data) {
    return {
        cwd: readString(data.cwd),
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
        exitCode:
            typeof data.exitCode === 'number' || data.exitCode === null ? data.exitCode : null,
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
        'analysis',
        'approval',
        'artifact',
        'command',
        'message',
        'patch',
        'plan',
        'preamble',
        'reasoning',
        'tool',
    ].includes(value)
        ? value
        : null;
}

function isRawAssistantItemId(id) {
    return id.startsWith('raw-assistant');
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
