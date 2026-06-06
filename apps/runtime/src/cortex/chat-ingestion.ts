import type { Database } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import {
    advanceChatIngestionCursor,
    type ChatIngestionChatRow,
    type ChatIngestionMessageRow,
    findChatIngestionReviewAudit,
    isOperationalMessage,
    listChatIngestionChats,
    listChatIngestionMessages,
    sourceRefFromMessage,
} from './chat-ingestion-cursor';
import {
    buildChatIngestionReviewPrompt,
    codexChatIngestionResponsesUrl,
    reviewChatIngestionBatchWithModel,
} from './chat-ingestion-review';
import { getActiveCortexSchema } from './cortex-schema';
import type { CortexDatabase } from './db';
import { findDreamContextPages, parseDreamReviewResponse } from './dream';
import { applyDreamProposal } from './dream-apply';
import type { DreamSourceRange } from './dream-types';
import { hashText } from './ids';
import { buildCortexLlmAuditMetadata } from './llm-audit';
import { nowIso } from './rows';
import { getCortexSettings } from './settings';

export interface CortexChatIngestionResult {
    captured: number;
    chatsReviewed: number;
    modelReviewed: boolean;
    reviewed: number;
}

export async function runCortexChatIngestion(
    runtimeDb: Database,
    cortexDb: CortexDatabase
): Promise<CortexChatIngestionResult> {
    const chats = await listChatIngestionChats(runtimeDb, cortexDb);
    if (chats.length === 0) {
        await writeCortexAudit(cortexDb, {
            kind: 'chat_ingestion.review',
            metadata: {},
            recordRefs: [],
            sourceRefs: [],
            status: 'skipped',
            summary: 'No new chat messages to review for Cortex Chat Ingestion.',
        });
        return { captured: 0, chatsReviewed: 0, modelReviewed: false, reviewed: 0 };
    }

    const result: CortexChatIngestionResult = {
        captured: 0,
        chatsReviewed: 0,
        modelReviewed: false,
        reviewed: 0,
    };
    for (const chat of chats) {
        const batchResult = await processChatIngestionChat(runtimeDb, cortexDb, chat);
        result.captured += batchResult.captured;
        result.chatsReviewed += batchResult.chatsReviewed;
        result.modelReviewed ||= batchResult.modelReviewed;
        result.reviewed += batchResult.reviewed;
    }
    return result;
}

async function processChatIngestionChat(
    runtimeDb: Database,
    cortexDb: CortexDatabase,
    chat: ChatIngestionChatRow
): Promise<CortexChatIngestionResult> {
    const rows = listChatIngestionMessages(runtimeDb, chat);
    const lastRow = rows.at(-1);
    if (!lastRow) {
        return { captured: 0, chatsReviewed: 0, modelReviewed: false, reviewed: 0 };
    }

    const meaningfulRows = rows.filter((row) => !isOperationalMessage(row.content));
    if (meaningfulRows.length === 0) {
        await advanceChatIngestionCursor(cortexDb, {
            chatId: chat.chat_id,
            lastMessageId: lastRow.id,
            lastProcessedAt: nowIso(),
            lastSequence: lastRow.sequence,
            sourceHash: null,
        });
        await writeCortexAudit(cortexDb, {
            kind: 'chat_ingestion.review',
            metadata: {
                chatId: chat.chat_id,
                messageIds: rows.map((row) => row.id),
                sequenceEnd: lastRow.sequence,
                sequenceStart: rows[0]?.sequence ?? lastRow.sequence,
            },
            recordRefs: [],
            sourceRefs: rows.map(sourceRefFromMessage),
            status: 'skipped',
            summary: `Cortex Chat Ingestion skipped ${rows.length} operational chat message(s).`,
        });
        return {
            captured: 0,
            chatsReviewed: 1,
            modelReviewed: false,
            reviewed: rows.length,
        };
    }

    const sourceRange = buildChatIngestionSourceRange(chat, meaningfulRows);
    if (await findChatIngestionReviewAudit(cortexDb, sourceRange.sourceHash)) {
        await advanceChatIngestionCursor(cortexDb, {
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

    const model = parseModelRef((await getCortexSettings(cortexDb)).models.chatIngestion).model;
    const contextPages = await findDreamContextPages(cortexDb, sourceRange.text);
    const activeSchema = await getActiveCortexSchema(cortexDb);
    const prompt = buildChatIngestionReviewPrompt({
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
        review = await reviewChatIngestionBatchWithModel({ model, prompt });
        const proposal = parseDreamReviewResponse(review.outputText);
        const applied = await applyDreamProposal(cortexDb, {
            model,
            origin: {
                frontmatterKey: 'chat_ingestion',
                relationshipSourceLocation: 'chat_ingestion',
                tag: 'chat-ingestion',
            },
            outputHash: hashText(review.outputText),
            promptHash,
            proposal,
            sourceRange,
        });
        await writeCortexAudit(cortexDb, {
            kind: 'chat_ingestion.review',
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
                route: codexChatIngestionResponsesUrl,
                sourceHash: sourceRange.sourceHash,
                tokenCounts: review.tokenCounts,
            }),
            recordRefs: applied.pageIds,
            sourceRefs: sourceRange.sourceRefs,
            status: 'success',
            summary: `Cortex Chat Ingestion reviewed ${meaningfulRows.length} message(s) in ${chat.title} and touched ${applied.pagesTouched} page(s).`,
        });
        await advanceChatIngestionCursor(cortexDb, {
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
        await writeCortexAudit(cortexDb, {
            kind: 'chat_ingestion.review',
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
                route: codexChatIngestionResponsesUrl,
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

function parseModelRef(modelRef: string) {
    const separatorIndex = modelRef.indexOf('/');
    return {
        model: separatorIndex >= 0 ? modelRef.slice(separatorIndex + 1) : modelRef,
        provider: separatorIndex >= 0 ? modelRef.slice(0, separatorIndex) : 'codex',
    };
}

function buildChatIngestionSourceRange(
    chat: ChatIngestionChatRow,
    rows: ChatIngestionMessageRow[]
): DreamSourceRange {
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
