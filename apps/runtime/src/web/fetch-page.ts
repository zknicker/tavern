import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
// @ts-expect-error Turndown does not publish TypeScript declarations.
import TurndownService from 'turndown';

const maxBodyBytes = 2 * 1024 * 1024;
const maxMarkdownCharacters = 40_000;
const truncationMarker = '\n\n[Content truncated at 40000 characters]';

export interface FetchedPage {
    finalUrl: string;
    markdown: string;
    title: string | null;
    truncated: boolean;
}

export async function fetchPageAsMarkdown(url: string): Promise<FetchedPage> {
    const parsedUrl = parseUrl(url);
    const response = await fetchResponse(parsedUrl);
    if (!response.ok) {
        throw new Error(`Web request failed with status ${response.status}.`);
    }

    const contentType = response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        ?.trim()
        .toLowerCase();
    if (!(contentType && isAllowedContentType(contentType))) {
        throw new Error(`Unsupported content type: ${contentType ?? 'unknown'}.`);
    }

    const body = await readLimitedBody(response);
    const converted = convertBody(body.text, contentType);
    const capped = capMarkdown(converted.markdown);

    return {
        finalUrl: response.url,
        markdown: capped.markdown,
        title: converted.title,
        truncated: body.truncated || capped.truncated,
    };
}

function parseUrl(value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Invalid URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http(s) URLs can be fetched.');
    }
    return url;
}

async function fetchResponse(url: URL): Promise<Response> {
    try {
        return await fetch(url, {
            headers: {
                accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
                'user-agent': 'Tavern/1.0 (+web_fetch)',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(20_000),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch URL: ${message}`);
    }
}

function isAllowedContentType(contentType: string): boolean {
    return (
        contentType.startsWith('text/') ||
        contentType === 'application/xhtml+xml' ||
        contentType === 'application/json'
    );
}

async function readLimitedBody(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: '', truncated: false };
    }

    const decoder = new TextDecoder();
    let byteCount = 0;
    let text = '';
    let truncated = false;

    while (true) {
        const result = await reader.read();
        if (result.done) {
            break;
        }

        const remaining = maxBodyBytes - byteCount;
        if (result.value.byteLength > remaining) {
            text += decoder.decode(result.value.subarray(0, remaining), {
                stream: true,
            });
            truncated = true;
            await reader.cancel();
            break;
        }

        byteCount += result.value.byteLength;
        text += decoder.decode(result.value, { stream: true });
    }

    text += decoder.decode();
    return { text, truncated };
}

function convertBody(body: string, contentType: string) {
    if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
        return htmlToMarkdown(body);
    }
    if (contentType === 'application/json') {
        return { markdown: prettyPrintJson(body), title: null };
    }
    return { markdown: body, title: null };
}

function htmlToMarkdown(html: string) {
    const { document } = parseHTML(html);
    const fallbackTitle = cleanTitle(document.querySelector('title')?.textContent);
    const article = new Readability(
        document.cloneNode(true) as unknown as ConstructorParameters<typeof Readability>[0]
    ).parse();
    const extractedHtml = article?.content ?? document.body?.innerHTML ?? html;
    const turndown = new TurndownService({
        codeBlockStyle: 'fenced',
        headingStyle: 'atx',
    });

    return {
        markdown: turndown.turndown(extractedHtml),
        title: cleanTitle(article?.title) ?? fallbackTitle,
    };
}

function cleanTitle(title: string | null | undefined): string | null {
    const cleaned = title?.trim();
    return cleaned ? cleaned : null;
}

function prettyPrintJson(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

function capMarkdown(markdown: string) {
    if (markdown.length <= maxMarkdownCharacters) {
        return { markdown, truncated: false };
    }
    return {
        markdown: `${markdown.slice(0, maxMarkdownCharacters - truncationMarker.length)}${truncationMarker}`,
        truncated: true,
    };
}
