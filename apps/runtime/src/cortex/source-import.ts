import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { CortexImportInput, CortexImportKind, CortexImportResult } from '@tavern/api';
import type { CortexDatabase } from './db';
import { hashText } from './ids';
import { ingestCortexSource } from './ingest';
import { getCortexSettings, resolveCortexOpenAiApiKey } from './settings';
import {
    type CortexRawImportFile,
    preserveImportFiles,
    rawImportFile,
} from './source-import-files';
import { ocrImageWithOpenAi, transcribeWithOpenAi } from './source-import-openai';

export interface CortexImportProcessors {
    fetchText?: (locator: string) => Promise<{ content: string; mediaType?: string }>;
    ocrImage?: (
        input: CortexProcessorInput
    ) => Promise<{ content: string; metadata?: Record<string, unknown> }>;
    readRepository?: (
        input: CortexProcessorInput
    ) => Promise<{ content: string; metadata?: Record<string, unknown> }>;
    transcribeMedia?: (
        input: CortexProcessorInput
    ) => Promise<{ content: string; metadata?: Record<string, unknown> }>;
}

export interface CortexProcessorInput {
    kind: CortexImportKind;
    locator?: string;
    mediaType?: string;
    metadata: Record<string, unknown>;
    modelRef?: string;
    rawBytes?: Uint8Array;
    rawFileName?: string;
}

interface PreparedImport {
    content: string;
    files: CortexRawImportFile[];
    locator?: string;
    mediaType?: string;
    metadata: Record<string, unknown>;
}

export async function importCortexSource(
    db: CortexDatabase,
    input: CortexImportInput,
    processors: CortexImportProcessors = {}
): Promise<CortexImportResult> {
    const prepared = await prepareImport(db, input, processors);
    const title =
        input.title?.trim() || inferImportTitle(input.kind, prepared.locator, prepared.metadata);
    const result = await ingestCortexSource(db, {
        actor: input.actor,
        content: prepared.content,
        kind: input.kind,
        locator: prepared.locator,
        metadata: {
            ...prepared.metadata,
            importKind: input.kind,
            mediaType: prepared.mediaType ?? null,
        },
        tags: uniqueStrings(['import', input.kind, ...(input.tags ?? [])]),
        title,
        type: input.type ?? defaultImportType(input.kind),
    });
    const files = await preserveImportFiles(db, {
        files: prepared.files,
        pageId: result.page.id,
        slug: result.page.slug,
        sourceId: result.sourceRef.id,
    });
    return {
        ...result,
        files,
        importKind: input.kind,
        normalizedContent: prepared.content,
    };
}

async function prepareImport(
    db: CortexDatabase,
    input: CortexImportInput,
    processors: CortexImportProcessors
): Promise<PreparedImport> {
    const rawBytes = input.rawContentBase64
        ? new Uint8Array(Buffer.from(input.rawContentBase64, 'base64'))
        : undefined;
    const metadata = { ...(input.metadata ?? {}) };
    let content = input.content?.trim();
    let mediaType = input.mediaType;
    const locator = input.locator;
    const files: PreparedImport['files'] = [];

    if (!content && needsFetch(input.kind, locator)) {
        const fetched = await fetchImportText(locator, processors);
        content = normalizeTextByMediaType(fetched.content, fetched.mediaType);
        mediaType = mediaType ?? fetched.mediaType;
        files.push(
            rawImportFile(fetched.content, input.rawFileName ?? `${input.kind}.html`, mediaType)
        );
    }

    if (!content && rawBytes && textLikeImport(input.kind)) {
        content = await decodeTextImport(input.kind, rawBytes);
    }

    if (!content && mediaNeedsTranscription(input.kind)) {
        const modelRef = (await getCortexSettings(db)).models.audioTranscription;
        const transcript = processors.transcribeMedia
            ? await processors.transcribeMedia(processorInput(input, rawBytes, modelRef))
            : await transcribeWithOpenAi({
                  apiKey: await resolveCortexOpenAiApiKey(),
                  input: processorInput(input, rawBytes, modelRef),
              });
        content = transcript.content;
        Object.assign(metadata, transcript.metadata);
    }

    if (!content && imageNeedsOcr(input.kind)) {
        const modelRef = (await getCortexSettings(db)).models.ocr;
        const ocr = processors.ocrImage
            ? await processors.ocrImage(processorInput(input, rawBytes, modelRef))
            : await ocrImageWithOpenAi({
                  apiKey: await resolveCortexOpenAiApiKey(),
                  input: processorInput(input, rawBytes, modelRef),
              });
        content = ocr.content;
        Object.assign(metadata, ocr.metadata);
    }

    if (!content && input.kind === 'repo') {
        const repo = processors.readRepository
            ? await processors.readRepository(processorInput(input, rawBytes))
            : await readLocalRepository(input.locator);
        content = repo.content;
        Object.assign(metadata, repo.metadata);
    }

    if (!content) {
        throw new Error(`Cortex import could not extract text for ${input.kind}.`);
    }

    if (rawBytes) {
        files.push(
            rawImportFile(rawBytes, input.rawFileName ?? defaultRawFileName(input.kind), mediaType)
        );
    } else if (input.content) {
        files.push(
            rawImportFile(
                input.content,
                input.rawFileName ?? `${input.kind}.txt`,
                mediaType ?? 'text/plain'
            )
        );
    } else if (files.length === 0) {
        mediaType = mediaType ?? 'text/plain';
        files.push(rawImportFile(content, `${input.kind}.txt`, mediaType));
    }

    return {
        content,
        files,
        locator: locator ?? `content:${hashText(content).slice(0, 24)}`,
        mediaType,
        metadata,
    };
}

async function fetchImportText(
    locator: string | undefined,
    processors: CortexImportProcessors
): Promise<{ content: string; mediaType?: string }> {
    if (!locator) {
        throw new Error('Cortex import fetch requires a locator.');
    }
    if (processors.fetchText) {
        return processors.fetchText(locator);
    }
    const response = await fetch(locator);
    if (!response.ok) {
        throw new Error(`Cortex import fetch failed (${response.status}) for ${locator}.`);
    }
    return {
        content: await response.text(),
        mediaType: response.headers.get('content-type') ?? undefined,
    };
}

function processorInput(
    input: CortexImportInput,
    rawBytes: Uint8Array | undefined,
    modelRef?: string
): CortexProcessorInput {
    return {
        kind: input.kind,
        locator: input.locator,
        mediaType: input.mediaType,
        metadata: input.metadata ?? {},
        modelRef,
        rawBytes,
        rawFileName: input.rawFileName,
    };
}

async function readLocalRepository(
    locator: string | undefined
): Promise<{ content: string; metadata: Record<string, unknown> }> {
    if (!locator) {
        throw new Error(
            'Cortex repo import requires a local repository path or repository processor.'
        );
    }
    const rootStat = await stat(locator);
    if (!rootStat.isDirectory()) {
        throw new Error(`Cortex repo import expected a directory: ${locator}`);
    }
    const entries = await readdir(locator);
    const files = ['README.md', 'package.json', 'AGENTS.md'].filter((name) =>
        entries.includes(name)
    );
    const parts: string[] = [];
    for (const file of files) {
        const content = await readFile(path.join(locator, file), 'utf8');
        parts.push(`File: ${file}\n\n${content.trim()}`);
    }
    if (parts.length === 0) {
        throw new Error(`Cortex repo import found no supported summary files in ${locator}.`);
    }
    return { content: parts.join('\n\n'), metadata: { files } };
}

async function decodeTextImport(kind: CortexImportKind, bytes: Uint8Array): Promise<string> {
    const text = Buffer.from(bytes).toString('utf8');
    if (kind === 'pdf' || kind === 'book') {
        return (await extractPdfTextFromBytes(bytes)) || extractPdfLiteralText(text);
    }
    return text;
}

async function extractPdfTextFromBytes(bytes: Uint8Array): Promise<string> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    try {
        const document = await pdfjs.getDocument({ data: Uint8Array.from(bytes) }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber);
            const textContent = await page.getTextContent();
            pages.push(
                textContent.items
                    .map((item) => ('str' in item ? item.str : ''))
                    .join(' ')
                    .trim()
            );
        }
        return normalizeExtractedText(pages.join('\n\n'));
    } catch {
        return '';
    }
}

function extractPdfLiteralText(text: string): string {
    if (!text.startsWith('%PDF')) {
        return text.trim();
    }
    const matches = Array.from(text.matchAll(/\((?<value>(?:\\.|[^\\)])*)\)\s*Tj/gu));
    return normalizeExtractedText(
        matches.map((match) => decodePdfLiteral(match.groups?.value ?? '')).join(' ')
    );
}

function decodePdfLiteral(value: string): string {
    return value
        .replace(/\\([()\\])/gu, '$1')
        .replace(/\\n/gu, '\n')
        .replace(/\\r/gu, '\r');
}

function normalizeTextByMediaType(content: string, mediaType: string | undefined): string {
    return mediaType?.includes('html') ? stripHtml(content) : content.trim();
}

function normalizeExtractedText(value: string): string {
    return value.replace(/\s+/gu, ' ').trim();
}

function stripHtml(value: string): string {
    return value
        .replace(/<script[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style[\s\S]*?<\/style>/giu, ' ')
        .replace(/<[^>]+>/gu, ' ')
        .replace(/&nbsp;/gu, ' ')
        .replace(/&amp;/gu, '&')
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/\s+/gu, ' ')
        .trim();
}

function needsFetch(kind: CortexImportKind, locator: string | undefined): boolean {
    return Boolean(locator?.startsWith('http') && ['article', 'x-post'].includes(kind));
}

function textLikeImport(kind: CortexImportKind): boolean {
    return ['book', 'document', 'pdf', 'transcript', 'x-post'].includes(kind);
}

function mediaNeedsTranscription(kind: CortexImportKind): boolean {
    return ['audio', 'podcast', 'video'].includes(kind);
}

function imageNeedsOcr(kind: CortexImportKind): boolean {
    return ['image', 'screenshot'].includes(kind);
}

function defaultImportType(kind: CortexImportKind): string {
    if (kind === 'podcast') {
        return 'podcast';
    }
    if (kind === 'x-post') {
        return 'x-post';
    }
    return 'source';
}

function inferImportTitle(
    kind: CortexImportKind,
    locator: string | undefined,
    metadata: Record<string, unknown>
): string {
    const metadataTitle = typeof metadata.title === 'string' ? metadata.title.trim() : '';
    if (metadataTitle) {
        return metadataTitle;
    }
    const locatorTail = locator?.split('/').filter(Boolean).at(-1);
    return `${kind}: ${locatorTail || 'source'}`;
}

function defaultRawFileName(kind: CortexImportKind): string {
    return kind === 'pdf' || kind === 'book' ? `${kind}.pdf` : `${kind}.bin`;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
