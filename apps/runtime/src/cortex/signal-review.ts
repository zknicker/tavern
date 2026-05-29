import { loadCodexCredentials } from '@tavern/codex-usage/credentials';
import { estimateDreamCostUsd, readResponseText, readTokenCounts } from './dream';
import type { DreamContextPage, DreamSourceRange } from './dream-types';

export const codexSignalResponsesUrl = 'https://chatgpt.com/backend-api/codex/responses';

export function buildSignalReviewPrompt(input: {
    contextPages: DreamContextPage[];
    linkTypes: string[];
    pageTypes: string[];
    sourceRange: DreamSourceRange;
}): string {
    return [
        'You are running Tavern Cortex Signal.',
        'Review this single-chat backlog batch for durable memory. This is near-real-time capture, not broad consolidation.',
        'Analyze only the provided new messages. Do not recreate facts from prior conversation context that is not present.',
        'Capture original user thinking first, then durable entities, preferences, decisions, corrections, facts, tasks, events, and relationships.',
        'Use the user exact phrasing for original thinking when possible.',
        'No-op operational chatter, transient execution status, acknowledgements, secrets, credentials, and broad summaries.',
        'Preserve source provenance with message-id locators. Avoid duplicate pages and duplicate facts.',
        'If new information contradicts older context, preserve both pieces of evidence and use contradicted/superseded observations or contradicts relationships.',
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
                    compiledTruth: 'current best understanding',
                    frontmatter: {},
                    slug: 'page-slug',
                    tags: ['signal'],
                    title: 'Page Title',
                    type: input.pageTypes.join('|'),
                },
            ],
            relationships: [
                {
                    fromSlug: 'page-slug',
                    label: 'optional label',
                    linkKind: input.linkTypes.join('|'),
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
        '',
        `Existing Cortex context:\n${JSON.stringify(input.contextPages)}`,
        '',
        `Source range:\n${input.sourceRange.text}`,
    ].join('\n\n');
}

export async function reviewSignalBatchWithModel(input: {
    model: string;
    prompt: string;
}): Promise<{
    estimatedCostUsd: number | null;
    latencyMs: number;
    outputText: string;
    requestId: string | null;
    tokenCounts: Record<string, unknown> | null;
}> {
    const credentials = await loadSignalCodexCredentials();
    const startedAt = performance.now();
    const response = await fetch(codexSignalResponsesUrl, {
        body: JSON.stringify({
            input: [{ content: input.prompt, role: 'user' }],
            model: input.model,
            store: false,
            text: { format: { type: 'json_object' } },
        }),
        headers: buildCodexSignalHeaders(credentials.credentials),
        method: 'POST',
    });
    if (!response.ok) {
        throw new Error(await formatSignalReviewError(response));
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

async function formatSignalReviewError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
    } | null;
    const message = typeof body?.error?.message === 'string' ? body.error.message : null;
    return message
        ? `Cortex Signal model review failed (${response.status}): ${message}`
        : `Cortex Signal model review failed (${response.status}).`;
}

type CodexCredentials = NonNullable<Awaited<ReturnType<typeof loadCodexCredentials>>>;

async function loadSignalCodexCredentials(): Promise<CodexCredentials> {
    try {
        const credentials = await loadCodexCredentials({ environment: process.env });
        if (!credentials) {
            throw new Error('missing Codex OAuth credentials');
        }
        return credentials;
    } catch (error) {
        throw new Error('Codex OAuth credentials are required for Cortex Signal.', {
            cause: error,
        });
    }
}

function buildCodexSignalHeaders(credentials: {
    accessToken: string;
    accountId: string | null;
}): Headers {
    const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${credentials.accessToken}`,
        'content-type': 'application/json',
        'OpenAI-Beta': 'responses=experimental',
        originator: 'tavern-cortex-signal',
        'User-Agent': 'tavern-runtime',
    });
    if (credentials.accountId) {
        headers.set('chatgpt-account-id', credentials.accountId);
    }
    return headers;
}
