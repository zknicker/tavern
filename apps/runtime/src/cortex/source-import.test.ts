import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CortexImportKind } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { type CortexDatabase, closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { getCortexPage } from './read';
import { saveCortexSettings } from './settings';
import { importCortexSource } from './source-import';
import { syncCortexMarkdown } from './sync';

describe('Cortex source import', () => {
    let wikiPath: string;

    beforeEach(async () => {
        wikiPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-import-'));
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(wikiPath, 'empty-codex-home');
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
    });

    afterEach(async () => {
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(wikiPath, { force: true, recursive: true });
    });

    test('imports article HTML through the fetch processor', async () => {
        const result = await importCortexSource(
            getCortexDb(),
            {
                kind: 'article',
                locator: 'https://example.com/shopjoyhaus-growth',
                metadata: { author: 'Example Author' },
                title: 'ShopJoyHaus Growth Article',
            },
            {
                fetchText: async () => ({
                    content:
                        '<article><h1>Growth</h1><p>ShopJoyHaus uses [[etsy]] tests.</p></article>',
                    mediaType: 'text/html',
                }),
            }
        );

        await expectCortexImport(result, {
            content: 'ShopJoyHaus uses [[etsy]] tests.',
            kind: 'article',
            mediaType: 'text/html',
        });
        expect(result.page.links[0]).toMatchObject({ targetSlug: 'etsy' });
    });

    test.each([
        {
            content: 'X post says Zach should test [[etsy]] listing thumbnails.',
            kind: 'x-post' as const,
            mediaType: 'text/plain',
            rawFileName: 'post.txt',
            title: 'X Post Thumbnail Idea',
            type: 'x-post',
        },
        {
            content: 'A document records the [[shopjoyhaus]] automation checklist.',
            kind: 'document' as const,
            mediaType: 'text/plain',
            rawFileName: 'doc.txt',
            title: 'Automation Checklist',
        },
        {
            content: 'Transcript mentions [[openrouter]] routing decisions.',
            kind: 'transcript' as const,
            mediaType: 'text/plain',
            rawFileName: 'transcript.txt',
            title: 'Routing Transcript',
        },
    ])('imports text-backed $kind sources', async (input) => {
        const result = await importCortexSource(getCortexDb(), {
            content: input.content,
            kind: input.kind,
            locator: `fixture:${input.kind}`,
            mediaType: input.mediaType,
            rawFileName: input.rawFileName,
            title: input.title,
            type: input.type,
        });

        await expectCortexImport(result, {
            content: input.content,
            kind: input.kind,
            mediaType: input.mediaType,
        });
    });

    test.each([
        {
            kind: 'audio' as const,
            mediaType: 'audio/mpeg',
            transcript: 'Audio transcript captures a [[podcast]] idea.',
        },
        {
            kind: 'podcast' as const,
            mediaType: 'audio/mp4',
            transcript: 'Podcast transcript discusses [[design]] positioning.',
            type: 'podcast',
        },
        {
            kind: 'video' as const,
            mediaType: 'video/mp4',
            transcript: 'Video transcript explains [[automation]] workflows.',
        },
    ])('imports transcribed $kind sources', async (input) => {
        const result = await importCortexSource(
            getCortexDb(),
            {
                kind: input.kind,
                locator: `fixture:${input.kind}`,
                mediaType: input.mediaType,
                rawContentBase64: base64(`${input.kind} bytes`),
                rawFileName: `${input.kind}.bin`,
                title: `${input.kind} source`,
                type: input.type,
            },
            {
                transcribeMedia: async (processorInput) => ({
                    content: input.transcript,
                    metadata: { provider: 'test-transcriber', sourceKind: processorInput.kind },
                }),
            }
        );

        await expectCortexImport(result, {
            content: input.transcript,
            kind: input.kind,
            mediaType: input.mediaType,
        });
        expect(result.page.frontmatter.metadata).toMatchObject({
            provider: 'test-transcriber',
        });
    });

    test.each([
        {
            kind: 'pdf' as const,
            mediaType: 'application/pdf',
            pdfText: 'PDF text names [[production-partner]] evidence.',
            title: 'Production Partner PDF',
        },
        {
            kind: 'book' as const,
            mediaType: 'application/pdf',
            pdfText: 'Book chapter studies [[investing]] discipline.',
            title: 'Investing Book',
        },
    ])('imports extractable $kind sources', async (input) => {
        const result = await importCortexSource(getCortexDb(), {
            kind: input.kind,
            locator: `fixture:${input.kind}.pdf`,
            mediaType: input.mediaType,
            rawContentBase64: base64(`%PDF-1.4\nBT (${input.pdfText}) Tj ET`),
            rawFileName: `${input.kind}.pdf`,
            title: input.title,
        });

        await expectCortexImport(result, {
            content: input.pdfText,
            kind: input.kind,
            mediaType: input.mediaType,
        });
    });

    test('imports a valid text PDF fixture through local extraction', async () => {
        const pdfText = 'Valid PDF text names [[shopjoyhaus]] packaging evidence.';
        const result = await importCortexSource(getCortexDb(), {
            kind: 'pdf',
            locator: 'fixture:valid-text.pdf',
            mediaType: 'application/pdf',
            rawContentBase64: base64(validTextPdf(pdfText)),
            rawFileName: 'valid-text.pdf',
            title: 'Valid Text PDF',
        });

        await expectCortexImport(result, {
            content: pdfText,
            kind: 'pdf',
            mediaType: 'application/pdf',
        });
        const rawPath = path.join(
            process.env.TAVERN_CORTEX_WIKI_PATH ?? '',
            result.files[0]?.path ?? ''
        );
        expect(await readFile(rawPath, 'utf8')).toContain('xref');
    });

    test.each([
        {
            kind: 'image' as const,
            mediaType: 'image/png',
            ocrText: 'Image OCR sees [[listing]] conversion notes.',
        },
        {
            kind: 'screenshot' as const,
            mediaType: 'image/png',
            ocrText: 'Screenshot OCR captures [[x-post]] text.',
        },
    ])('imports OCR-backed $kind sources', async (input) => {
        const result = await importCortexSource(
            getCortexDb(),
            {
                kind: input.kind,
                locator: `fixture:${input.kind}.png`,
                mediaType: input.mediaType,
                rawContentBase64: base64(`${input.kind} image bytes`),
                rawFileName: `${input.kind}.png`,
                title: `${input.kind} source`,
            },
            {
                ocrImage: async (processorInput) => ({
                    content: input.ocrText,
                    metadata: { ocrProvider: 'test-vision', sourceKind: processorInput.kind },
                }),
            }
        );

        await expectCortexImport(result, {
            content: input.ocrText,
            kind: input.kind,
            mediaType: input.mediaType,
        });
        expect(result.page.frontmatter.metadata).toMatchObject({
            ocrProvider: 'test-vision',
        });
    });

    test('imports a local repository from summary files', async () => {
        const repoPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-repo-'));
        try {
            await writeFile(
                path.join(repoPath, 'README.md'),
                '# Demo Repo\n\nRepo describes [[tavern]] plugin architecture.'
            );
            await writeFile(path.join(repoPath, 'package.json'), '{"name":"demo-repo"}');

            const result = await importCortexSource(getCortexDb(), {
                kind: 'repo',
                locator: repoPath,
                title: 'Demo Repository',
            });

            await expectCortexImport(result, {
                content: 'Repo describes [[tavern]] plugin architecture.',
                kind: 'repo',
                mediaType: 'text/plain',
            });
            expect(result.page.frontmatter.metadata).toMatchObject({
                files: ['README.md', 'package.json'],
            });
        } finally {
            await rm(repoPath, { force: true, recursive: true });
        }
    });

    test('keeps raw markdown attachments out of Cortex page sync', async () => {
        const db = getCortexDb();
        const result = await importCortexSource(db, {
            content: 'Markdown attachment mentions [[shopjoyhaus]].',
            kind: 'document',
            locator: 'fixture:readme',
            mediaType: 'text/markdown',
            rawFileName: 'README.md',
            title: 'Markdown Attachment',
        });
        const pageCountBefore = await countRows(db, 'cortex_pages');

        await syncCortexMarkdown(db);

        expect(await countRows(db, 'cortex_pages')).toBe(pageCountBefore);
        expect(result.files[0]?.path).toBe('.raw/markdown-attachment/README.md');
    });

    test('uses configured models for media transcription and OCR imports', async () => {
        const db = getCortexDb();
        await saveCortexSettings(db, {
            embedding: {
                model: 'text-embedding-3-small',
                modelRef: 'openai/text-embedding-3-small',
                provider: 'openai',
            },
            models: {
                audioTranscription: 'openai/whisper-1',
                ocr: 'openai/gpt-4o-mini',
            },
        });

        const audioResult = await importCortexSource(
            db,
            {
                kind: 'audio',
                locator: 'fixture:voice-note',
                mediaType: 'audio/mpeg',
                rawContentBase64: base64('voice note bytes'),
                rawFileName: 'voice-note.mp3',
                title: 'Voice Note',
            },
            {
                transcribeMedia: async (processorInput) => ({
                    content: `Audio model ${processorInput.modelRef} heard [[etsy]] notes.`,
                    metadata: { modelRef: processorInput.modelRef },
                }),
            }
        );
        const imageResult = await importCortexSource(
            db,
            {
                kind: 'image',
                locator: 'fixture:listing.png',
                mediaType: 'image/png',
                rawContentBase64: base64('listing image bytes'),
                rawFileName: 'listing.png',
                title: 'Listing Image',
            },
            {
                ocrImage: async (processorInput) => ({
                    content: `OCR model ${processorInput.modelRef} saw [[listing]] notes.`,
                    metadata: { modelRef: processorInput.modelRef },
                }),
            }
        );

        expect(audioResult.page.frontmatter.metadata).toMatchObject({
            modelRef: 'openai/whisper-1',
        });
        expect(audioResult.normalizedContent).toContain(
            'Audio model openai/whisper-1 heard [[etsy]] notes.'
        );
        expect(imageResult.page.frontmatter.metadata).toMatchObject({
            modelRef: 'openai/gpt-4o-mini',
        });
        expect(imageResult.normalizedContent).toContain(
            'OCR model openai/gpt-4o-mini saw [[listing]] notes.'
        );
    });
});

async function expectCortexImport(
    result: Awaited<ReturnType<typeof importCortexSource>>,
    expected: { content: string; kind: CortexImportKind; mediaType: string }
) {
    const db = getCortexDb();
    const page = await getCortexPage(db, result.page.slug);

    expect(page?.compiledTruth).toContain(expected.content);
    expect(page?.sourceRefs[0]).toMatchObject({
        id: result.sourceRef.id,
        kind: expected.kind,
    });
    expect(result.importKind).toBe(expected.kind);
    expect(result.normalizedContent).toContain(expected.content);
    expect(result.files[0]).toMatchObject({
        mediaType: expected.mediaType,
    });

    const sourceCount = await countRows(db, 'cortex_sources');
    const fileCount = await countRows(db, 'cortex_files');
    const citationCount = await countRows(db, 'cortex_citations');
    const auditCount = await countRows(db, 'cortex_audit_events');
    expect(sourceCount).toBeGreaterThan(0);
    expect(fileCount).toBeGreaterThan(0);
    expect(citationCount).toBeGreaterThan(0);
    expect(auditCount).toBeGreaterThan(0);

    const rawPath = path.join(
        process.env.TAVERN_CORTEX_WIKI_PATH ?? '',
        result.files[0]?.path ?? ''
    );
    expect(await readFile(rawPath, 'utf8')).not.toHaveLength(0);
}

async function countRows(db: CortexDatabase, table: string): Promise<number> {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<{ count: number }>();
    return row?.count ?? 0;
}

function base64(value: string): string {
    return Buffer.from(value).toString('base64');
}

function validTextPdf(text: string): string {
    const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
    const objects = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = objects.map((object) => {
        const offset = pdf.length;
        pdf += object;
        return offset;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return pdf;
}

function escapePdfText(value: string): string {
    return value.replace(/[()\\]/gu, (character) => `\\${character}`);
}
