import type { CortexDreamReportHealth, CortexDreamReportPhase, CortexSourceRef } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings';
import { writeCortexAudit } from './audit';
import type { CortexDatabase } from './db';
import { applyDreamProposal } from './dream-apply';
import {
    addCortexDreamReportItem,
    finishCortexDreamReport,
    startCortexDreamReport,
} from './dream-report';
import type {
    CortexDreamResult,
    DreamContextPage,
    DreamNoop,
    DreamProposal,
    DreamSourceRange,
    DreamWarning,
} from './dream-types';
import { generateStaleCortexEmbeddings } from './embeddings';
import { hashText, slugifyCortexTitle } from './ids';
import {
    type CortexIssue,
    detectCortexIssues,
    summarizeCortexHealth,
    summarizeCortexIssues,
} from './lint';
import { buildCortexLlmAuditMetadata } from './llm-audit';
import { getCortexPage } from './read';
import { runCortexRepairDerivedState } from './repair-derived-state';
import { type PageRow, readJsonArray, readJsonRecord, scoreLexical, tokenize } from './rows';
import { getCortexSettings } from './settings';
import { syncCortexMarkdown } from './sync';

const codexResponsesUrl = 'https://chatgpt.com/backend-api/codex/responses';

export async function runCortexDream(
    _runtimeDb: Database,
    cortexDb: CortexDatabase
): Promise<CortexDreamResult> {
    const modelRef = (await getCortexSettings(cortexDb)).models.dream;
    const { model, provider } = parseModelRef(modelRef);
    const phases: CortexDreamReportPhase[] = [];
    let healthBefore: CortexDreamReportHealth | null = null;
    const report = await startCortexDreamReport(cortexDb, {
        healthBefore: null,
        model,
        provider,
    });
    try {
        await runDreamPhase(phases, 'Sync', async () => {
            const result = await syncCortexMarkdown(cortexDb);
            return `Synced ${result.pagesSynced} Cortex page(s).`;
        });

        let issues: CortexIssue[] = [];
        await runDreamPhase(phases, 'Health scan', async () => {
            issues = await detectCortexIssues(cortexDb);
            healthBefore = summarizeCortexHealth(issues);
            return summarizeCortexIssues(issues);
        });

        await runDreamPhase(phases, 'Maintenance', async () => {
            const result = await runCortexRepairDerivedState(cortexDb, {
                now: new Date().toISOString(),
            });
            return result.summary;
        });

        const selection = await runDreamPhase(phases, 'Select work', async () => {
            const range = await buildDreamConsolidationSourceRange(cortexDb, issues);
            const pages = await findDreamContextPages(cortexDb, range.text);
            return {
                result: { contextPages: pages, sourceRange: range },
                summary: `Selected ${dreamItemCount(range)} Cortex work item(s) and ${pages.length} context page(s).`,
            };
        });
        const { contextPages, sourceRange } = selection;

        if (dreamItemCount(sourceRange) === 0) {
            await writeSkippedDreamAudit(
                cortexDb,
                'No Cortex changes or health issues to consolidate.'
            );
            await finishCortexDreamReport(cortexDb, report.id, {
                healthAfter: healthBefore,
                healthBefore,
                noops: ['No Cortex changes or health issues to consolidate.'],
                phases,
                status: 'skipped',
                summary: 'Dream skipped because Cortex had no consolidation work.',
            });
            return { captured: 0, modelReviewed: false, reportId: report.id, reviewed: 0 };
        }

        const existingAudit = await findDreamReviewAudit(cortexDb, sourceRange.sourceHash);
        if (existingAudit) {
            await finishCortexDreamReport(cortexDb, report.id, {
                healthAfter: healthBefore,
                healthBefore,
                noops: ['Selected Cortex work already has a successful Dream review.'],
                phases,
                status: 'skipped',
                summary: 'Dream skipped because the selected Cortex work was already reviewed.',
            });
            return {
                captured: 0,
                modelReviewed: false,
                reportId: report.id,
                reviewed: dreamItemCount(sourceRange),
            };
        }

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
            await writeCortexAudit(cortexDb, {
                kind: 'dream.review',
                metadata: buildCortexLlmAuditMetadata({
                    extra: {
                        captureKey: sourceRange.captureKey,
                        reportId: report.id,
                        workItemCount: dreamItemCount(sourceRange),
                    },
                    model,
                    promptHash: hashText(prompt),
                    provider,
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
        const applied = await runDreamPhase(phases, 'Consolidate', async () => {
            const result = await applyDreamProposal(cortexDb, {
                model,
                outputHash: hashText(outputText),
                promptHash: hashText(prompt),
                proposal,
                sourceRange,
            });
            return {
                result,
                summary: `Touched ${result.pagesTouched} Cortex page(s), ${proposal.relationships.length} relationship(s), and ${proposal.timelineEntries.length} timeline entrie(s).`,
            };
        });

        await writeDreamReportItems(cortexDb, report.id, proposal, applied.pageIds);

        await runDreamPhase(phases, 'Post-write repair', async () => {
            const sync = await syncCortexMarkdown(cortexDb);
            const repair = await runCortexRepairDerivedState(cortexDb, {
                now: new Date().toISOString(),
            });
            const embeddings = await generateStaleCortexEmbeddings(
                cortexDb,
                new Date().toISOString()
            );
            return `Synced ${sync.pagesSynced} page(s); ${repair.summary}; generated ${embeddings.length} embedding(s).`;
        });

        let finalIssues: CortexIssue[] = [];
        await runDreamPhase(phases, 'Final health', async () => {
            finalIssues = await detectCortexIssues(cortexDb);
            return summarizeCortexIssues(finalIssues);
        });

        const healthAfter = summarizeCortexHealth(finalIssues);
        await writeCortexAudit(cortexDb, {
            kind: 'dream.review',
            metadata: buildCortexLlmAuditMetadata({
                extra: {
                    captureKey: sourceRange.captureKey,
                    contextPages: contextPages.map((page) => page.slug),
                    noops: applied.noops,
                    reportId: report.id,
                    warnings: applied.warnings,
                    workItemCount: dreamItemCount(sourceRange),
                },
                latencyMs: review.latencyMs,
                model,
                outputHash: applied.outputHash,
                promptHash: applied.promptHash,
                provider,
                requestId: review.requestId,
                route: codexResponsesUrl,
                sourceHash: sourceRange.sourceHash,
                tokenCounts: review.tokenCounts,
                estimatedCostUsd: review.estimatedCostUsd,
            }),
            recordRefs: applied.pageIds,
            sourceRefs: sourceRange.sourceRefs,
            status: 'success',
            summary: `Dream consolidated ${dreamItemCount(sourceRange)} Cortex work item(s) and touched ${applied.pagesTouched} page(s).`,
        });

        await finishCortexDreamReport(cortexDb, report.id, {
            estimatedCostUsd: review.estimatedCostUsd,
            healthAfter,
            healthBefore,
            noops: applied.noops.map((noop) => noop.reason),
            phases,
            status: 'success',
            summary: buildDreamReportSummary({
                healthAfter,
                healthBefore,
                pagesTouched: applied.pagesTouched,
                workItemCount: dreamItemCount(sourceRange),
            }),
            warnings: applied.warnings.map((warning) => warning.message),
        });

        return {
            captured: applied.pagesTouched,
            modelReviewed: true,
            reportId: report.id,
            reviewed: dreamItemCount(sourceRange),
        };
    } catch (error) {
        await finishCortexDreamReport(cortexDb, report.id, {
            healthAfter: healthBefore,
            healthBefore,
            phases,
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

async function loadDreamCodexCredentials(): ReturnType<typeof loadVaultBackedCodexCredentials> {
    try {
        return await loadVaultBackedCodexCredentials();
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

async function buildDreamConsolidationSourceRange(
    db: CortexDatabase,
    issues: CortexIssue[]
): Promise<DreamSourceRange> {
    const pages = await listDreamCandidatePages(db);
    const audits = await listDreamCandidateAudits(db);
    const issueLines = issues.slice(0, 80).map((issue) => `- ${issue.kind}: ${issue.summary}`);
    const pageLines = pages.map(
        (page) =>
            `## ${page.title} (${page.slug}, ${page.type})\nUpdated: ${page.updated_at}\nCompiled truth:\n${truncateText(
                page.compiled_truth || page.body,
                1500
            )}\nBody:\n${truncateText(page.body, 1200)}`
    );
    const auditLines = audits.map(
        (audit) =>
            `- ${audit.kind} ${audit.status} ${audit.created_at}: ${audit.summary} ${truncateText(
                audit.metadata_json,
                500
            )}`
    );
    const text = [
        '# Cortex health issues',
        issueLines.length ? issueLines.join('\n') : 'No lint issues.',
        '',
        '# Recent Cortex pages',
        pageLines.length ? pageLines.join('\n\n') : 'No recent pages.',
        '',
        '# Recent Cortex audit evidence',
        auditLines.length ? auditLines.join('\n') : 'No recent audit events.',
    ].join('\n');
    const sourceRefs = uniqueSourceRefs(pages.flatMap((page) => readPageSourceRefs(page)));
    const sourceHash = hashText(text);
    return {
        captureKey: hashText(
            JSON.stringify({
                auditIds: audits.map((audit) => audit.id),
                issueCount: issues.length,
                pageIds: pages.map((page) => page.id),
                sourceHash,
            })
        ),
        itemCount: pages.length + audits.length + issues.length,
        messageIds: [],
        sourceHash,
        sourceRefs,
        text,
    };
}

async function listDreamCandidatePages(db: CortexDatabase): Promise<PageRow[]> {
    return await db
        .prepare(
            `SELECT *
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND status IN ('active', 'stale')
             ORDER BY updated_at DESC
             LIMIT 24`
        )
        .all<PageRow>();
}

async function listDreamCandidateAudits(db: CortexDatabase): Promise<
    Array<{
        created_at: string;
        id: string;
        kind: string;
        metadata_json: string;
        status: string;
        summary: string;
    }>
> {
    return await db
        .prepare(
            `SELECT id, kind, status, summary, metadata_json, created_at
             FROM cortex_audit_events
             WHERE kind != 'dream.review'
             ORDER BY created_at DESC
             LIMIT 40`
        )
        .all<{
            created_at: string;
            id: string;
            kind: string;
            metadata_json: string;
            status: string;
            summary: string;
        }>();
}

function readPageSourceRefs(page: Pick<PageRow, 'source_refs_json'>): CortexSourceRef[] {
    return readJsonArray<CortexSourceRef>(page.source_refs_json).filter(
        (ref) => typeof ref.id === 'string' && typeof ref.kind === 'string'
    );
}

export async function findDreamContextPages(
    db: CortexDatabase,
    text: string
): Promise<DreamContextPage[]> {
    const terms = tokenize(text).slice(0, 80);
    const rows = await db
        .prepare(
            `SELECT *
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND status IN ('active', 'stale')`
        )
        .all<PageRow>();

    const ranked = rows
        .map((row) => ({
            row,
            score: scoreLexical(
                `${row.title} ${row.slug} ${row.compiled_truth} ${row.body}`,
                terms
            ),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);
    const contextPages: DreamContextPage[] = [];
    for (const { row } of ranked) {
        const page = await getCortexPage(db, row.id);
        contextPages.push({
            compiledTruth: row.compiled_truth,
            links:
                page?.links.map((link) => ({
                    linkKind: link.linkKind,
                    targetSlug: link.targetSlug,
                })) ?? [],
            slug: row.slug,
            title: row.title,
            type: row.type,
        });
    }
    return contextPages;
}

function buildDreamReviewPrompt(input: {
    contextPages: DreamContextPage[];
    sourceRange: DreamSourceRange;
}): string {
    return [
        'You are running Tavern Cortex Dream: a daily consolidation pass over the existing Cortex knowledgebase.',
        'Review bounded Cortex pages, audit evidence, and health findings. Produce durable updates that improve the knowledgebase.',
        'Do entity sweep, citation hygiene, memory consolidation, relationship repair, stale-truth repair, and cross-session pattern detection.',
        'Use existing context pages when possible. Avoid duplicate pages.',
        'Every useful claim must preserve source provenance through timeline entries, observations, and citations.',
        'Return JSON only with this shape:',
        JSON.stringify({
            citations: [
                {
                    locator: 'message-id-or-range',
                    pageSlug: 'page-slug',
                    quote: 'short quote',
                },
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
        '- Only write durable business facts, preferences, decisions, reusable project context, relationships, corrections, and recurring patterns.',
        '- Do not capture secrets, credentials, transient execution chatter, or broad summaries.',
        '- Pattern detection should create or update pattern pages when there is source-backed repeated behavior.',
        '- Use generic page/link types from the schema. If a better page/link type is needed, use it; Runtime will register it as a Cortex schema addition.',
        '- compiledTruth is the current best understanding. timelineEntries are append-only evidence.',
        '- Create new pages only for durable subjects likely to be useful again. If durable but no subject page fits, write a note page with a clear title.',
        '- Include relationships whenever reviewed material connects two Cortex pages. Do not invent facts or relationships that are not grounded in the source range or existing context.',
        '- Prefer improving existing pages over duplicating source pages.',
        '',
        `Existing Cortex context:\n${JSON.stringify(input.contextPages)}`,
        '',
        `Source range:\n${input.sourceRange.text}`,
    ].join('\n\n');
}

async function runDreamPhase<T>(
    phases: CortexDreamReportPhase[],
    name: string,
    callback: () => Promise<T | { result: T; summary: string } | string>
): Promise<T> {
    const started = performance.now();
    try {
        const value = await callback();
        const { result, summary } = normalizeDreamPhaseResult<T>(value);
        phases.push({
            durationMs: Math.max(0, Math.round(performance.now() - started)),
            metadata: {},
            name,
            status: 'success',
            summary,
        });
        return result;
    } catch (error) {
        phases.push({
            durationMs: Math.max(0, Math.round(performance.now() - started)),
            metadata: {},
            name,
            status: 'error',
            summary: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

function normalizeDreamPhaseResult<T>(value: T | { result: T; summary: string } | string): {
    result: T;
    summary: string;
} {
    if (typeof value === 'string') {
        return { result: value as T, summary: value };
    }
    if (value && typeof value === 'object' && 'result' in value && 'summary' in value) {
        return value as { result: T; summary: string };
    }
    return { result: value as T, summary: 'Completed.' };
}

async function writeDreamReportItems(
    db: CortexDatabase,
    reportId: string,
    proposal: DreamProposal,
    pageIds: string[]
): Promise<void> {
    for (const pageWrite of proposal.pageWrites) {
        const slug = slugifyCortexTitle(pageWrite.slug || pageWrite.title);
        await addCortexDreamReportItem(db, reportId, {
            kind:
                pageWrite.type === 'pattern' || pageWrite.tags?.includes('pattern')
                    ? 'pattern-created'
                    : pageWrite.action === 'archive'
                      ? 'page-updated'
                      : pageIds.length > 0
                        ? 'page-updated'
                        : 'page-created',
            metadata: {
                action: pageWrite.action ?? 'upsert',
                type: pageWrite.type ?? 'note',
            },
            pageSlug: slug,
            summary: pageWrite.compiledTruth,
            title: pageWrite.title,
        });
    }
    for (const relationship of proposal.relationships) {
        await addCortexDreamReportItem(db, reportId, {
            kind: 'relationship-added',
            metadata: {
                fromSlug: relationship.fromSlug,
                linkKind: relationship.linkKind,
                targetSlug: relationship.targetSlug,
            },
            pageSlug: slugifyCortexTitle(relationship.fromSlug),
            summary: `${relationship.fromSlug} ${relationship.linkKind} ${relationship.targetSlug}.`,
            title: relationship.label || relationship.linkKind,
        });
    }
    for (const citation of proposal.citations) {
        await addCortexDreamReportItem(db, reportId, {
            kind: 'citation-added',
            metadata: {
                locator: citation.locator,
                quote: citation.quote ?? null,
            },
            pageSlug: citation.pageSlug,
            summary: `Added citation from ${citation.locator}.`,
            title: citation.pageSlug,
        });
    }
    for (const warning of proposal.warnings) {
        await addCortexDreamReportItem(db, reportId, {
            kind: 'warning',
            summary: warning.message,
            title: 'Warning',
        });
    }
    for (const noop of proposal.noops) {
        await addCortexDreamReportItem(db, reportId, {
            kind: 'noop',
            summary: noop.reason,
            title: 'No-op',
        });
    }
}

function buildDreamReportSummary(input: {
    healthAfter: CortexDreamReportHealth;
    healthBefore: CortexDreamReportHealth | null;
    pagesTouched: number;
    workItemCount: number;
}): string {
    const before = input.healthBefore?.score ?? input.healthAfter.score;
    return `Reviewed ${input.workItemCount} Cortex work item(s), touched ${input.pagesTouched} page(s), and moved health ${before} -> ${input.healthAfter.score}.`;
}

function dreamItemCount(sourceRange: DreamSourceRange): number {
    return sourceRange.itemCount ?? 0;
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

async function findDreamReviewAudit(
    db: CortexDatabase,
    sourceHash: string
): Promise<string | null> {
    const rows = await db
        .prepare(
            `SELECT id, metadata_json
             FROM cortex_audit_events
             WHERE kind = 'dream.review'
               AND status = 'success'
             ORDER BY created_at DESC
             LIMIT 200`
        )
        .all<{ id: string; metadata_json: string }>();
    for (const row of rows) {
        if (readJsonRecord(row.metadata_json).sourceHash === sourceHash) {
            return row.id;
        }
    }
    return null;
}

async function writeSkippedDreamAudit(db: CortexDatabase, summary: string): Promise<void> {
    await writeCortexAudit(db, {
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

function uniqueSourceRefs(refs: CortexSourceRef[]): CortexSourceRef[] {
    const seen = new Set<string>();
    const unique: CortexSourceRef[] = [];
    for (const ref of refs) {
        const key = `${ref.id}:${ref.kind}:${ref.locator ?? ''}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        unique.push(ref);
    }
    return unique;
}

function truncateText(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 20)}\n[truncated]`;
}
