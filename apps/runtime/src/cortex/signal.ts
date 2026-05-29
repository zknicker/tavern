import type { Database } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { getActiveCortexSchema } from './cortex-schema';
import { findDreamContextPages, parseDreamReviewResponse } from './dream';
import { applyDreamProposal } from './dream-apply';
import type { DreamSourceRange } from './dream-types';
import { hashText } from './ids';
import { buildCortexLlmAuditMetadata } from './llm-audit';
import { nowIso } from './rows';
import {
    advanceSignalCursor,
    findSignalReviewAudit,
    isOperationalMessage,
    listSignalChats,
    listSignalMessages,
    type SignalChatRow,
    type SignalMessageRow,
    sourceRefFromMessage,
} from './signal-cursor';
import {
    buildSignalReviewPrompt,
    codexSignalResponsesUrl,
    reviewSignalBatchWithModel,
} from './signal-review';

const defaultCortexSignalModel = 'gpt-5.5';

export interface CortexSignalResult {
    captured: number;
    chatsReviewed: number;
    modelReviewed: boolean;
    reviewed: number;
}

export async function runCortexSignal(db: Database): Promise<CortexSignalResult> {
    const chats = listSignalChats(db);
    if (chats.length === 0) {
        writeCortexAudit(db, {
            kind: 'signal.review',
            metadata: {},
            recordRefs: [],
            sourceRefs: [],
            status: 'skipped',
            summary: 'No new chat messages to review for Cortex Signal.',
        });
        return { captured: 0, chatsReviewed: 0, modelReviewed: false, reviewed: 0 };
    }

    const result: CortexSignalResult = {
        captured: 0,
        chatsReviewed: 0,
        modelReviewed: false,
        reviewed: 0,
    };
    for (const chat of chats) {
        const batchResult = await processSignalChat(db, chat);
        result.captured += batchResult.captured;
        result.chatsReviewed += batchResult.chatsReviewed;
        result.modelReviewed ||= batchResult.modelReviewed;
        result.reviewed += batchResult.reviewed;
    }
    return result;
}

async function processSignalChat(db: Database, chat: SignalChatRow): Promise<CortexSignalResult> {
    const rows = listSignalMessages(db, chat);
    const lastRow = rows.at(-1);
    if (!lastRow) {
        return { captured: 0, chatsReviewed: 0, modelReviewed: false, reviewed: 0 };
    }

    const meaningfulRows = rows.filter((row) => !isOperationalMessage(row.content));
    if (meaningfulRows.length === 0) {
        advanceSignalCursor(db, {
            chatId: chat.chat_id,
            lastMessageId: lastRow.id,
            lastProcessedAt: nowIso(),
            lastSequence: lastRow.sequence,
            sourceHash: null,
        });
        writeCortexAudit(db, {
            kind: 'signal.review',
            metadata: {
                chatId: chat.chat_id,
                messageIds: rows.map((row) => row.id),
                sequenceEnd: lastRow.sequence,
                sequenceStart: rows[0]?.sequence ?? lastRow.sequence,
            },
            recordRefs: [],
            sourceRefs: rows.map(sourceRefFromMessage),
            status: 'skipped',
            summary: `Cortex Signal skipped ${rows.length} operational chat message(s).`,
        });
        return {
            captured: 0,
            chatsReviewed: 1,
            modelReviewed: false,
            reviewed: rows.length,
        };
    }

    const sourceRange = buildSignalSourceRange(chat, meaningfulRows);
    if (findSignalReviewAudit(db, sourceRange.sourceHash)) {
        advanceSignalCursor(db, {
            chatId: chat.chat_id,
            lastMessageId: lastRow.id,
            lastProcessedAt: nowIso(),
            lastSequence: lastRow.sequence,
            sourceHash: sourceRange.sourceHash,
        });
        return {
            captured: 0,
            chatsReviewed: 1,
            modelReviewed: false,
            reviewed: meaningfulRows.length,
        };
    }

    const model =
        process.env.TAVERN_CORTEX_SIGNAL_MODEL?.trim() ||
        process.env.TAVERN_CORTEX_DREAM_MODEL?.trim() ||
        defaultCortexSignalModel;
    const contextPages = findDreamContextPages(db, sourceRange.text);
    const activeSchema = getActiveCortexSchema(db);
    const prompt = buildSignalReviewPrompt({
        contextPages,
        linkTypes: activeSchema.linkTypes.map((type) => type.name),
        pageTypes: activeSchema.pageTypes,
        sourceRange,
    });
    const promptHash = hashText(prompt);
    let review: {
        estimatedCostUsd: number | null;
        latencyMs: number;
        outputText: string;
        requestId: string | null;
        tokenCounts: Record<string, unknown> | null;
    };
    try {
        review = await reviewSignalBatchWithModel({ model, prompt });
        const proposal = parseDreamReviewResponse(review.outputText);
        const applied = applyDreamProposal(db, {
            model,
            origin: {
                frontmatterKey: 'signal',
                relationshipSourceLocation: 'signal',
                tag: 'signal',
            },
            outputHash: hashText(review.outputText),
            promptHash,
            proposal,
            sourceRange,
        });
        writeCortexAudit(db, {
            kind: 'signal.review',
            metadata: buildCortexLlmAuditMetadata({
                estimatedCostUsd: review.estimatedCostUsd,
                extra: {
                    chatId: chat.chat_id,
                    contextPages: contextPages.map((page) => page.slug),
                    messageIds: sourceRange.messageIds,
                    noops: applied.noops,
                    sequenceEnd: lastRow.sequence,
                    sequenceStart: meaningfulRows[0]?.sequence ?? lastRow.sequence,
                    warnings: applied.warnings,
                },
                latencyMs: review.latencyMs,
                model,
                outputHash: applied.outputHash,
                promptHash: applied.promptHash,
                provider: 'codex',
                requestId: review.requestId,
                route: codexSignalResponsesUrl,
                sourceHash: sourceRange.sourceHash,
                tokenCounts: review.tokenCounts,
            }),
            recordRefs: applied.pageIds,
            sourceRefs: sourceRange.sourceRefs,
            status: 'success',
            summary: `Cortex Signal reviewed ${meaningfulRows.length} message(s) in ${chat.title} and touched ${applied.pagesTouched} page(s).`,
        });
        advanceSignalCursor(db, {
            chatId: chat.chat_id,
            lastMessageId: lastRow.id,
            lastProcessedAt: nowIso(),
            lastSequence: lastRow.sequence,
            sourceHash: sourceRange.sourceHash,
        });
        return {
            captured: applied.pagesTouched,
            chatsReviewed: 1,
            modelReviewed: true,
            reviewed: meaningfulRows.length,
        };
    } catch (error) {
        writeCortexAudit(db, {
            kind: 'signal.review',
            metadata: buildCortexLlmAuditMetadata({
                extra: {
                    chatId: chat.chat_id,
                    messageIds: sourceRange.messageIds,
                    sequenceEnd: lastRow.sequence,
                    sequenceStart: meaningfulRows[0]?.sequence ?? lastRow.sequence,
                },
                model,
                promptHash,
                provider: 'codex',
                route: codexSignalResponsesUrl,
                sourceHash: sourceRange.sourceHash,
            }),
            recordRefs: [],
            sourceRefs: sourceRange.sourceRefs,
            status: 'error',
            summary: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

function buildSignalSourceRange(chat: SignalChatRow, rows: SignalMessageRow[]): DreamSourceRange {
    const text = rows
        .map(
            (row) =>
                `[${row.role} ${row.id} seq=${row.sequence} author=${row.author_id} at=${row.created_at}] ${row.content}`
        )
        .join('\n\n');
    const sourceRefs = rows.map(sourceRefFromMessage);
    const sourceHash = hashText(`${chat.chat_id}:${text}`);
    return {
        captureKey: hashText(
            JSON.stringify({
                chatId: chat.chat_id,
                messageIds: rows.map((row) => row.id),
                sourceHash,
            })
        ),
        messageIds: rows.map((row) => row.id),
        sourceHash,
        sourceRefs,
        text,
    };
}
