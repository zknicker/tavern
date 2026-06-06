import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CortexImportResult } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ensureCortexRuntimeBootstrap } from './bootstrap';
import { closeCortexDb, getCortexDb, initTestCortexDb } from './db';
import { getCortexPage } from './read';
import { saveCortexSettings } from './settings';
import { importCortexSource } from './source-import';

const run = promisify(execFile);
describe('Cortex live source import smoke', () => {
    let workPath: string;
    let wikiPath: string;

    beforeEach(async () => {
        workPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-live-import-'));
        wikiPath = path.join(workPath, 'wiki');
        process.env.TAVERN_CORTEX_WIKI_PATH = wikiPath;
        process.env.CODEX_HOME = path.join(workPath, 'empty-codex-home');
        await initTestCortexDb();
        await ensureCortexRuntimeBootstrap(getCortexDb());
        await saveCortexSettings(getCortexDb(), {
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
    });

    afterEach(async () => {
        await closeCortexDb();
        process.env.CODEX_HOME = undefined;
        process.env.TAVERN_CORTEX_WIKI_PATH = undefined;
        await rm(workPath, { force: true, recursive: true });
    });

    test('imports local text PDF, real OpenAI OCR, and real OpenAI transcription', async () => {
        const pdfText = 'Cortex live PDF says ShopJoyHaus packaging memory.';
        const pdfResult = await importCortexSource(getCortexDb(), {
            kind: 'pdf',
            locator: 'live-smoke:text-pdf',
            mediaType: 'application/pdf',
            rawContentBase64: base64(validTextPdf(pdfText)),
            rawFileName: 'cortex-live.pdf',
            title: 'Cortex Live PDF Smoke',
        });

        const imageText = 'CORTEX LIVE OCR SHOPJOYHAUS PACKAGING';
        const imagePath = path.join(workPath, 'ocr.png');
        await createPngWithText(imagePath, imageText);
        const imageResult = await importCortexSource(getCortexDb(), {
            kind: 'image',
            locator: 'live-smoke:image',
            mediaType: 'image/png',
            rawContentBase64: base64Buffer(await readFile(imagePath)),
            rawFileName: 'ocr.png',
            title: 'Cortex Live OCR Smoke',
        });

        const audioPhrase = 'Cortex live audio says packaging memory.';
        const audioPath = path.join(workPath, 'audio.wav');
        await createWavWithSpeech(audioPath, audioPhrase);
        const audioResult = await importCortexSource(getCortexDb(), {
            kind: 'audio',
            locator: 'live-smoke:audio',
            mediaType: 'audio/wav',
            rawContentBase64: base64Buffer(await readFile(audioPath)),
            rawFileName: 'audio.wav',
            title: 'Cortex Live Audio Smoke',
        });

        await expectPersistedContent(pdfResult, /ShopJoyHaus packaging memory/iu);
        await expectPersistedContent(imageResult, /SHOP\s*JOY\s*HAUS|SHOPJOYHAUS|PACKAGING/iu);
        await expectPersistedContent(audioResult, /cortex|packaging|memory/iu);
        expect(imageResult.page.frontmatter.metadata).toMatchObject({
            model: 'gpt-4o-mini',
            provider: 'openai',
        });
        expect(audioResult.page.frontmatter.metadata).toMatchObject({
            model: 'whisper-1',
            provider: 'openai',
        });

        const summary = {
            audio: summarizeResult(audioResult, audioPhrase),
            image: summarizeResult(imageResult, imageText),
            pdf: summarizeResult(pdfResult, pdfText),
        };

        if (process.env.TAVERN_CORTEX_LIVE_SMOKE_OUTPUT) {
            await writeFile(
                process.env.TAVERN_CORTEX_LIVE_SMOKE_OUTPUT,
                `${JSON.stringify(summary, null, 2)}\n`
            );
        }
    }, 180_000);
});

async function createPngWithText(filePath: string, text: string): Promise<void> {
    await run('convert', [
        '-size',
        '1200x320',
        'xc:white',
        '-gravity',
        'center',
        '-pointsize',
        '48',
        '-fill',
        'black',
        '-annotate',
        '0',
        text,
        filePath,
    ]);
}

async function createWavWithSpeech(filePath: string, text: string): Promise<void> {
    const aiffPath = filePath.replace(/\.wav$/u, '.aiff');
    await run('say', ['-o', aiffPath, text]);
    await run('ffmpeg', ['-y', '-i', aiffPath, '-ar', '16000', '-ac', '1', filePath]);
}

async function expectPersistedContent(result: CortexImportResult, expected: RegExp): Promise<void> {
    const page = await getCortexPage(getCortexDb(), result.page.slug);
    expect(page?.compiledTruth).toMatch(expected);
    expect(result.files).toHaveLength(1);
    expect(result.normalizedContent).toMatch(expected);
}

function summarizeResult(result: CortexImportResult, input: string) {
    return {
        fileCount: result.files.length,
        input,
        metadata: result.page.frontmatter.metadata,
        normalizedContent: result.normalizedContent,
        pageSlug: result.page.slug,
        sourceKind: result.sourceRef.kind,
    };
}

function base64(value: string): string {
    return Buffer.from(value).toString('base64');
}

function base64Buffer(value: Uint8Array): string {
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
