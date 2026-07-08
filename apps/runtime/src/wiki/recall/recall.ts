import { log } from '../../log.ts';
import { loadQmd } from './qmd-loader.ts';
import { ensureRecallStore, isRecallVectorReady } from './recall-index.ts';

/**
 * Per-turn Wiki recall: embed the triggering message, surface the top shared
 * Wiki pages above the relevance floor as bounded prompt context.
 * Raw-message vector search is the hot path; qmd's lex lane needs exact
 * keyword queries and is reserved for the wiki_search tool.
 */

export interface WikiRecallHit {
    path: string;
    score: number;
    snippet: string;
    title: string;
}

const recallHitLimit = 3;
const recallMinScore = 0.2;
const recallSnippetMaxLength = 240;
const recallMinQueryLength = 3;

export async function recallWikiPages(query: string): Promise<WikiRecallHit[]> {
    if (!isRecallVectorReady()) {
        return [];
    }
    const cleaned = stripRichReferenceLinks(query).trim();
    if (cleaned.length < recallMinQueryLength) {
        return [];
    }

    const [store, { extractSnippet }] = await Promise.all([ensureRecallStore(), loadQmd()]);
    const hits = await store.searchVector(cleaned, { limit: recallHitLimit + 2 });
    return hits
        .filter((hit) => hit.score >= recallMinScore)
        .slice(0, recallHitLimit)
        .map((hit) => ({
            path: hit.displayPath,
            score: hit.score,
            snippet: extractSnippet(hit.body ?? '', cleaned, recallSnippetMaxLength).snippet,
            title: hit.title,
        }));
}

export interface TurnWikiRecall {
    block: string;
    hits: WikiRecallHit[];
}

/**
 * Recall for one harness turn: the prompt block plus the structured hits for
 * turn evidence, or null when nothing clears the floor. Recall must never
 * fail a turn: errors degrade to no injection.
 */
export async function recallTurnWiki(query: string): Promise<TurnWikiRecall | null> {
    try {
        const hits = await recallWikiPages(query);
        if (hits.length === 0) {
            return null;
        }
        const block = [
            'Recalled Wiki:',
            ...hits.map(
                (hit) => `- ${hit.title} [${hit.path}]: ${collapseWhitespace(hit.snippet)}`
            ),
        ].join('\n');
        return { block, hits };
    } catch (error) {
        log.warn('Wiki recall failed for turn prompt', { err: error });
        return null;
    }
}

/**
 * Hybrid search for the wiki_search agent tool: lex lane for exact keywords
 * plus a vector lane when embeddings are provisioned. No rerank or expansion
 * models — pre-expanded queries keep qmd's model scope to embeddings only.
 */
export async function searchWikiPages(input: { limit?: number; query: string }) {
    const [store, { extractSnippet }] = await Promise.all([ensureRecallStore(), loadQmd()]);
    const query = stripRichReferenceLinks(input.query).trim();
    const limit = input.limit ?? 10;
    const hits = await store.search({
        limit,
        queries: [
            { query, type: 'lex' },
            ...(isRecallVectorReady() ? [{ query, type: 'vec' as const }] : []),
        ],
        rerank: false,
    });
    return {
        hits: hits.map((hit) => ({
            path: hit.displayPath,
            score: hit.score,
            snippet: collapseWhitespace(
                hit.bestChunk || extractSnippet(hit.body, query, recallSnippetMaxLength).snippet
            ),
            title: hit.title,
        })),
        query: input.query,
        vectorLane: isRecallVectorReady(),
    };
}

function stripRichReferenceLinks(content: string) {
    return content.replace(
        /\[([^\]]+)\]\((?:agent|app|directory|file|plugin|skill):\/\/[^)]*\)/g,
        '$1'
    );
}

function collapseWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}
