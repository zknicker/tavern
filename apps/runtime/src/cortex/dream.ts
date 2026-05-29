import type { CortexSourceRef } from '@tavern/api';
import { loadCodexCredentials } from '@tavern/codex-usage/credentials';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { sourceRefFromChatMessage } from './chat-source-ref';
import { applyDreamProposal } from './dream-apply';
import type {
    CortexDreamResult,
    DreamContextPage,
    DreamMessageRow,
    DreamNoop,
    DreamProposal,
    DreamSourceRange,
    DreamWarning,
} from './dream-types';
import { hashText, slugifyCortexTitle } from './ids';
import { buildCortexLlmAuditMetadata } from './llm-audit';
import { getCortexPage } from './read';
import { type PageRow, readJsonRecord, scoreLexical, tokenize } from './rows';

const defaultCortexDreamModel = 'gpt-5.5';
const codexResponsesUrl = 'https://chatgpt.com/backend-api/codex/responses';

export async function runCortexDream(db: Database): Promise<CortexDreamResult> {
    const rows = listDreamMessages(db);
    if (rows.length === 0) {
        writeSkippedDreamAudit(db, 'No new chat messages to review.');
        return { captured: 0, modelReviewed: false, reviewed: 0 };
    }

    const sourceRange = buildDreamSourceRange(rows);
    const existingAudit = findDreamReviewAudit(db, sourceRange.sourceHash);
    if (existingAudit) {
        return { captured: 0, modelReviewed: false, reviewed: rows.length };
    }

    const model = process.env.TAVERN_CORTEX_DREAM_MODEL?.trim() || defaultCortexDreamModel;
    const contextPages = findDreamContextPages(db, sourceRange.text);
    const prompt = buildDreamReviewPrompt({ contextPages, sourceRange });
    let review: {
        estimatedCostUsd: number | null;
        latencyMs: number;
        outputText: string;
        requestId: string | null;
        tokenCounts: Record<string, unknown> | null;
    };
    try {
        review = await reviewDreamSourceRangeWithModel({ model, prompt });
    } catch (error) {
        writeCortexAudit(db, {
            kind: 'dream.review',
            metadata: buildCortexLlmAuditMetadata({
                extra: {
                    captureKey: sourceRange.captureKey,
                    messageIds: sourceRange.messageIds,
                },
                model,
                promptHash: hashText(prompt),
                provider: 'codex',
                route: codexResponsesUrl,
                sourceHash: sourceRange.sourceHash,
            }),
            recordRefs: [],
            sourceRefs: sourceRange.sourceRefs,
            status: 'error',
            summary: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
    const outputText = review.outputText;
    const proposal = parseDreamReviewResponse(outputText);
    const applied = applyDreamProposal(db, {
        model,
        outputHash: hashText(outputText),
        promptHash: hashText(prompt),
        proposal,
        sourceRange,
    });

    writeCortexAudit(db, {
        kind: 'dream.review',
        metadata: buildCortexLlmAuditMetadata({
            extra: {
                captureKey: sourceRange.captureKey,
                contextPages: contextPages.map((page) => page.slug),
                messageIds: sourceRange.messageIds,
                noops: applied.noops,
                warnings: applied.warnings,
            },
            latencyMs: review.latencyMs,
            model,
            outputHash: applied.outputHash,
            promptHash: applied.promptHash,
            provider: 'codex',
            requestId: review.requestId,
            route: codexResponsesUrl,
            sourceHash: sourceRange.sourceHash,
            tokenCounts: review.tokenCounts,
            estimatedCostUsd: review.estimatedCostUsd,
        }),
        recordRefs: applied.pageIds,
        sourceRefs: sourceRange.sourceRefs,
        status: 'success',
        summary: `Dream reviewed ${rows.length} message(s) and touched ${applied.pagesTouched} Cortex page(s).`,
    });

    return { captured: applied.pagesTouched, modelReviewed: true, reviewed: rows.length };
}

async function reviewDreamSourceRangeWithModel(input: { model: string; prompt: string }): Promise<{
    estimatedCostUsd: number | null;
    latencyMs: number;
    outputText: string;
    requestId: string | null;
    tokenCounts: Record<string, unknown> | null;
}> {
    const credentials = await loadDreamCodexCredentials();
    if (!credentials) {
        throw new Error('Codex OAuth credentials are required for Cortex Dream.');
    }
    const startedAt = performance.now();
    const response = await fetch(codexResponsesUrl, {
        body: JSON.stringify({
            input: [
                {
                    content: input.prompt,
                    role: 'user',
                },
            ],
            model: input.model,
            store: false,
            text: { format: { type: 'json_object' } },
        }),
        headers: buildCodexDreamHeaders(credentials.credentials),
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(await formatDreamReviewError(response));
    }
    const body = await response.json();
    const tokenCounts = readTokenCounts(body);
    return {
        estimatedCostUsd: estimateDreamCostUsd(tokenCounts),
        latencyMs: Math.round(performance.now() - startedAt),
        outputText: readResponseText(body),
        requestId: response.headers.get('x-request-id'),
        tokenCounts,
    };
}

async function loadDreamCodexCredentials(): ReturnType<typeof loadCodexCredentials> {
    try {
        return await loadCodexCredentials({ environment: process.env });
    } catch (error) {
        throw new Error('Codex OAuth credentials are required for Cortex Dream.', {
            cause: error,
        });
    }
}

function buildCodexDreamHeaders(credentials: {
    accessToken: string;
    accountId: string | null;
}): Headers {
    const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${credentials.accessToken}`,
        'content-type': 'application/json',
        'OpenAI-Beta': 'responses=experimental',
        originator: 'tavern-cortex-dream',
        'User-Agent': 'tavern-runtime',
    });

    if (credentials.accountId) {
        headers.set('chatgpt-account-id', credentials.accountId);
    }

    return headers;
}

function listDreamMessages(db: Database): DreamMessageRow[] {
    const cursor = findLatestDreamReviewedMessageCursor(db);
    const condition = cursor
        ? 'AND (created_at > $cursorCreatedAt OR (created_at = $cursorCreatedAt AND id > $cursorId))'
        : '';
    return db
        .prepare(
            `SELECT id, chat_id, author_id, role, content, created_at
             FROM chat_messages
             WHERE deleted_at IS NULL
               AND content != ''
               ${condition}
             ORDER BY created_at ASC, id ASC
             LIMIT $limit`
        )
        .all(
            namedParams({
                cursorCreatedAt: cursor?.createdAt ?? '',
                cursorId: cursor?.id ?? '',
                limit: 50,
            })
        ) as DreamMessageRow[];
}

function buildDreamSourceRange(rows: DreamMessageRow[]): DreamSourceRange {
    const ordered = rows;
    const text = ordered.map((row) => `[${row.role} ${row.id}] ${row.content}`).join('\n\n');
    const sourceRefs = ordered.map(sourceRefFromMessage);
    const sourceHash = hashText(text);
    return {
        captureKey: hashText(
            JSON.stringify({ messageIds: ordered.map((row) => row.id), sourceHash })
        ),
        messageIds: ordered.map((row) => row.id),
        sourceHash,
        sourceRefs,
        text,
    };
}

function sourceRefFromMessage(row: DreamMessageRow): CortexSourceRef {
    return sourceRefFromChatMessage(row);
}

export function findDreamContextPages(db: Database, text: string): DreamContextPage[] {
    const terms = tokenize(text).slice(0, 80);
    const rows = db
        .prepare(
            `SELECT *
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND status IN ('active', 'stale')`
        )
        .all() as PageRow[];

    return rows
        .map((row) => ({
            row,
            score: scoreLexical(
                `${row.title} ${row.slug} ${row.compiled_truth} ${row.body}`,
                terms
            ),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8)
        .map(({ row }) => {
            const page = getCortexPage(db, row.id);
            return {
                compiledTruth: row.compiled_truth,
                links:
                    page?.links.map((link) => ({
                        linkKind: link.linkKind,
                        targetSlug: link.targetSlug,
                    })) ?? [],
                slug: row.slug,
                title: row.title,
                type: row.type,
            };
        });
}

function buildDreamReviewPrompt(input: {
    contextPages: DreamContextPage[];
    sourceRange: DreamSourceRange;
}): string {
    return [
        'You are running Tavern Cortex Dream.',
        'Convert bounded source material into durable Cortex updates.',
        'Do entity sweep, citation hygiene, memory consolidation, conversation synthesis, and cross-session pattern detection.',
        'Use existing context pages when possible. Avoid duplicate pages.',
        'Every useful claim must preserve source provenance through timeline entries, observations, and citations.',
        'Return JSON only with this shape:',
        JSON.stringify({
            citations: [
                { locator: 'message-id-or-range', pageSlug: 'page-slug', quote: 'short quote' },
            ],
            noops: [{ reason: 'why reviewed material was not captured' }],
            observations: [
                {
                    confidence: 0.8,
                    pageSlug: 'page-slug',
                    predicate: 'states|prefers|decided|tracks|uses',
                    status: 'active',
                    subject: 'subject',
                    value: 'source-backed fact',
                },
            ],
            pageWrites: [
                {
                    action: 'upsert',
                    aliases: [],
                    body: 'supporting detail and open context',
                    compiledTruth: 'current best synthesis',
                    frontmatter: {},
                    slug: 'page-slug',
                    tags: ['dream'],
                    title: 'Page Title',
                    type: 'project|product|brand|campaign|tool|decision|task|metric|idea|note',
                },
            ],
            relationships: [
                {
                    fromSlug: 'page-slug',
                    label: 'optional label',
                    linkKind:
                        'mentions|related_to|depends_on|blocks|supports|contradicts|same_as|uses|owns|targets|tracks|source',
                    targetSlug: 'target-slug',
                },
            ],
            timelineEntries: [
                {
                    body: 'source-backed event explaining what changed',
                    pageSlug: 'page-slug',
                },
            ],
            warnings: [{ message: 'ambiguity or conflict' }],
        }),
        'Rules:',
        '- Only capture durable business facts, preferences, decisions, reusable project context, relationships, corrections, and recurring patterns.',
        '- Do not capture secrets, credentials, transient execution chatter, or broad summaries.',
        '- Use generic page/link types from the schema. If unsure, use note + mentions or emit a warning/noop.',
        '- compiledTruth is the current best understanding. timelineEntries are append-only evidence.',
        '',
        `Existing Cortex context:\n${JSON.stringify(input.contextPages)}`,
        '',
        `Source range:\n${input.sourceRange.text}`,
    ].join('\n\n');
}

export function parseDreamReviewResponse(text: string): DreamProposal {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
        citations: readObjectArray(parsed.citations).flatMap((value) => {
            const pageSlug = readString(value.pageSlug);
            const locator = readString(value.locator);
            return pageSlug && locator
                ? [
                      {
                          locator,
                          pageSlug: slugifyCortexTitle(pageSlug),
                          quote: readString(value.quote),
                      },
                  ]
                : [];
        }),
        noops: readObjectArray(parsed.noops).flatMap(readNoop),
        observations: readObjectArray(parsed.observations).flatMap((value) => {
            const pageSlug = readString(value.pageSlug);
            const subject = readString(value.subject);
            const valueText = readString(value.value);
            return pageSlug && subject && valueText
                ? [
                      {
                          confidence: readConfidence(value.confidence),
                          pageSlug: slugifyCortexTitle(pageSlug),
                          predicate: readString(value.predicate) ?? 'states',
                          status: readObservationStatus(value.status),
                          subject,
                          value: valueText,
                      },
                  ]
                : [];
        }),
        pageWrites: readObjectArray(parsed.pageWrites).flatMap((value) => {
            const title = readString(value.title);
            const compiledTruth = readString(value.compiledTruth);
            return title && compiledTruth
                ? [
                      {
                          action: readAction(value.action),
                          aliases: readStringArray(value.aliases),
                          body: readString(value.body) ?? compiledTruth,
                          compiledTruth,
                          frontmatter: readRecord(value.frontmatter),
                          slug: readString(value.slug) ?? undefined,
                          tags: readStringArray(value.tags),
                          title,
                          type: readString(value.type) ?? 'note',
                      },
                  ]
                : [];
        }),
        relationships: readObjectArray(parsed.relationships).flatMap((value) => {
            const fromSlug = readString(value.fromSlug);
            const targetSlug = readString(value.targetSlug);
            const linkKind = readString(value.linkKind);
            return fromSlug && targetSlug && linkKind
                ? [
                      {
                          fromSlug: slugifyCortexTitle(fromSlug),
                          label: readString(value.label),
                          linkKind,
                          targetSlug: slugifyCortexTitle(targetSlug),
                      },
                  ]
                : [];
        }),
        timelineEntries: readObjectArray(parsed.timelineEntries).flatMap((value) => {
            const pageSlug = readString(value.pageSlug);
            const body = readString(value.body);
            return pageSlug && body
                ? [
                      {
                          body,
                          createdAt: readString(value.createdAt) ?? undefined,
                          pageSlug: slugifyCortexTitle(pageSlug),
                      },
                  ]
                : [];
        }),
        warnings: readObjectArray(parsed.warnings).flatMap(readWarning),
    };
}

function findDreamReviewAudit(db: Database, sourceHash: string): string | null {
    const rows = db
        .prepare(
            `SELECT id, metadata_json
             FROM cortex_audit_events
             WHERE kind = 'dream.review'
               AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 200`
        )
        .all() as Array<{ id: string; metadata_json: string }>;
    for (const row of rows) {
        if (readJsonRecord(row.metadata_json).sourceHash === sourceHash) {
            return row.id;
        }
    }
    return null;
}

function findLatestDreamReviewedMessageCursor(
    db: Database
): { createdAt: string; id: string } | null {
    const rows = db
        .prepare(
            `SELECT metadata_json
             FROM cortex_audit_events
             WHERE kind = 'dream.review'
               AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 20`
        )
        .all() as Array<{ metadata_json: string }>;
    for (const row of rows) {
        const messageIds = readStringArray(readJsonRecord(row.metadata_json).messageIds);
        if (messageIds.length === 0) {
            continue;
        }
        const placeholders = messageIds.map(() => '?').join(',');
        const latest = db
            .prepare(
                `SELECT id, created_at AS createdAt
                 FROM chat_messages
                 WHERE id IN (${placeholders})
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1`
            )
            .get(...messageIds) as { createdAt: string | null; id: string } | null;
        if (latest?.createdAt && latest.id) {
            return { createdAt: latest.createdAt, id: latest.id };
        }
    }
    return null;
}

function writeSkippedDreamAudit(db: Database, summary: string): void {
    writeCortexAudit(db, {
        kind: 'dream.review',
        metadata: {},
        recordRefs: [],
        sourceRefs: [],
        status: 'skipped',
        summary,
    });
}

export function readResponseText(body: unknown): string {
    const record = body as { output_text?: unknown };
    if (typeof record.output_text === 'string') {
        return record.output_text;
    }
    const output = (body as { output?: unknown }).output;
    if (Array.isArray(output)) {
        for (const item of output) {
            const content = (item as { content?: unknown }).content;
            if (!Array.isArray(content)) {
                continue;
            }
            for (const part of content) {
                const text = (part as { text?: unknown }).text;
                if (typeof text === 'string') {
                    return text;
                }
            }
        }
    }
    throw new Error('Cortex Dream model response did not include output text.');
}

export function readTokenCounts(body: unknown): Record<string, unknown> | null {
    const usage = (body as { usage?: unknown }).usage;
    return usage && typeof usage === 'object' && !Array.isArray(usage)
        ? (usage as Record<string, unknown>)
        : null;
}

export function estimateDreamCostUsd(tokenCounts: Record<string, unknown> | null): number | null {
    if (!tokenCounts) {
        return null;
    }
    const inputTokens =
        readNumber(tokenCounts.input_tokens) ?? readNumber(tokenCounts.prompt_tokens);
    const outputTokens =
        readNumber(tokenCounts.output_tokens) ?? readNumber(tokenCounts.completion_tokens);
    if (inputTokens === null && outputTokens === null) {
        return null;
    }
    // Conservative placeholder until Codex route exposes authoritative cost.
    return Number((((inputTokens ?? 0) * 1.25 + (outputTokens ?? 0) * 10) / 1_000_000).toFixed(6));
}

function readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function formatDreamReviewError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
    } | null;
    const message = typeof body?.error?.message === 'string' ? body.error.message : null;
    return message
        ? `Cortex Dream model review failed (${response.status}): ${message}`
        : `Cortex Dream model review failed (${response.status}).`;
}

function readObjectArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter(
              (item): item is Record<string, unknown> =>
                  !!item && typeof item === 'object' && !Array.isArray(item)
          )
        : [];
}

function readNoop(value: Record<string, unknown>): DreamNoop[] {
    const reason = readString(value.reason);
    return reason ? [{ reason }] : [];
}

function readWarning(value: Record<string, unknown>): DreamWarning[] {
    const message = readString(value.message);
    return message ? [{ message }] : [];
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []))
        : [];
}

function readConfidence(value: unknown): number {
    return typeof value === 'number' && value >= 0 && value <= 1 ? value : 0.7;
}

function readAction(value: unknown): 'archive' | 'upsert' {
    return value === 'archive' ? 'archive' : 'upsert';
}

function readObservationStatus(value: unknown): 'active' | 'contradicted' | 'stale' | 'superseded' {
    return value === 'contradicted' || value === 'stale' || value === 'superseded'
        ? value
        : 'active';
}
