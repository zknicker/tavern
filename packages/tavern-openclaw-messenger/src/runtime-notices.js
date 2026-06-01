import { activityStepFromProgressStep } from './tavern-api.js';

export async function recordRuntimeNotice({ context, input, notice, runId, startedAt }) {
    await requireTavernApi(context).updateTurnActivity(
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
            step: activityStepFromProgressStep({
                detail: notice.detail,
                id: notice.id,
                kind: 'custom',
                label: notice.title,
                metadata: {
                    runtime: {
                        notice,
                    },
                },
                status: 'completed',
            }),
        }
    );
}

export function splitOpenClawFinalPayload(payload) {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    const structuredNotice = classifyStructuredOpenClawRuntimeNotice(payload);

    if (structuredNotice) {
        return {
            notices: [structuredNotice],
            text: '',
        };
    }

    const lines = text.split(/\r?\n/u);
    const notices = [];
    let cursor = 0;

    while (cursor < lines.length) {
        while (cursor < lines.length && lines[cursor].trim() === '') {
            cursor += 1;
        }

        const notice = classifyOpenClawRuntimeNoticeText(lines[cursor]?.trim() ?? '');
        if (!notice) {
            break;
        }

        notices.push(notice);
        cursor += 1;
    }

    if (notices.length === 0) {
        return { notices, text };
    }

    return {
        notices,
        text: lines.slice(cursor).join('\n').trimStart(),
    };
}

function classifyOpenClawRuntimeNoticeText(text) {
    const sessionNotice = text.match(/^🧭?\s*New session: ([0-9a-f-]{36})$/iu);
    if (sessionNotice) {
        return {
            detail: sessionNotice[1],
            id: `runtime_notice_new_session_${sessionNotice[1]}`,
            kind: 'new_session',
            sessionId: sessionNotice[1],
            text,
            title: 'Started new session',
        };
    }

    const compactionNotice = text.match(
        /^🧹?\s*Auto-compaction complete(?: \(count (\d+)\))?\.$/iu
    );
    if (compactionNotice) {
        return {
            compactionCount: compactionNotice[1] ? Number.parseInt(compactionNotice[1], 10) : null,
            detail: text,
            id: 'runtime_notice_auto_compaction',
            kind: 'auto_compaction',
            sessionId: null,
            text,
            title: 'Compacted context',
        };
    }

    return null;
}

function classifyStructuredOpenClawRuntimeNotice(payload) {
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';

    if (!text) {
        return null;
    }

    if (payload?.isStatusNotice || payload?.isCompactionNotice || payload?.isFallbackNotice) {
        return {
            detail: text,
            id: `runtime_notice_${stableNoticeId(text)}`,
            kind: payload.isCompactionNotice ? 'auto_compaction' : 'status',
            sessionId: null,
            text,
            title: text,
        };
    }

    return null;
}

function stableNoticeId(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '_')
        .replace(/^_+|_+$/gu, '')
        .slice(0, 80);
}

function requireTavernApi(context) {
    if (!context?.tavern) {
        throw new Error('Tavern Messenger requires a Tavern API client.');
    }
    return context.tavern;
}
