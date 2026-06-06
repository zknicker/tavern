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
const PODCAST_AUDIO_URL =
    'https://www.nasa.gov/wp-content/uploads/2018/10/onamissionepisode-002.mp3';
const PODCAST_PAGE_URL = 'https://www.nasa.gov/podcasts/on-a-mission/music-of-the-spheres/';
const INFOGRAPHIC_URL =
    'https://upload.wikimedia.org/wikipedia/commons/5/57/Things_you_should_know_about_copyright_law_%28infographic%29_%2802%29.png';
const INFOGRAPHIC_PAGE_URL =
    'https://commons.wikimedia.org/wiki/File:Things_you_should_know_about_copyright_law_(infographic)_(02).png';
const PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

describe('Cortex real source import smoke', () => {
    let workPath: string;
    let wikiPath: string;

    beforeEach(async () => {
        workPath = await mkdtemp(path.join(tmpdir(), 'tavern-cortex-real-source-import-'));
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

    test('imports a real podcast clip, infographic image, and public PDF', async () => {
        const podcastPath = path.join(workPath, 'nasa-on-a-mission.mp3');
        const podcastClipPath = path.join(workPath, 'nasa-on-a-mission-10s.wav');
        await downloadRange(PODCAST_AUDIO_URL, podcastPath, '0-1048575');
        await trimAudioToWav(podcastPath, podcastClipPath);
        const podcastResult = await importCortexSource(getCortexDb(), {
            kind: 'podcast',
            locator: PODCAST_PAGE_URL,
            mediaType: 'audio/wav',
            metadata: {
                clipDurationSeconds: 10,
                sourceAudioUrl: PODCAST_AUDIO_URL,
                sourcePageUrl: PODCAST_PAGE_URL,
            },
            rawContentBase64: base64Buffer(await readFile(podcastClipPath)),
            rawFileName: 'nasa-on-a-mission-10s.wav',
            title: 'NASA On a Mission Podcast Clip',
        });

        const infographicPath = path.join(workPath, 'copyright-infographic.png');
        await download(INFOGRAPHIC_URL, infographicPath);
        const infographicResult = await importCortexSource(getCortexDb(), {
            kind: 'image',
            locator: INFOGRAPHIC_PAGE_URL,
            mediaType: 'image/png',
            metadata: {
                sourceImageUrl: INFOGRAPHIC_URL,
                sourcePageUrl: INFOGRAPHIC_PAGE_URL,
            },
            rawContentBase64: base64Buffer(await readFile(infographicPath)),
            rawFileName: 'copyright-law-infographic.png',
            title: 'Copyright Law Infographic',
        });

        const pdfPath = path.join(workPath, 'dummy.pdf');
        await download(PDF_URL, pdfPath);
        const pdfResult = await importCortexSource(getCortexDb(), {
            kind: 'pdf',
            locator: PDF_URL,
            mediaType: 'application/pdf',
            rawContentBase64: base64Buffer(await readFile(pdfPath)),
            rawFileName: 'w3c-dummy.pdf',
            title: 'W3C Dummy PDF',
        });

        await expectPersistedContent(podcastResult, /earth|rings|bell|earthquake/iu);
        await expectPersistedContent(
            infographicResult,
            /copyright law|public domain|exceptions|limitations/iu
        );
        await expectPersistedContent(pdfResult, /Dummy PDF file/iu);

        const summary = {
            image: summarizeResult(infographicResult, {
                sourceImageUrl: INFOGRAPHIC_URL,
                sourcePageUrl: INFOGRAPHIC_PAGE_URL,
            }),
            pdf: summarizeResult(pdfResult, {
                sourceUrl: PDF_URL,
            }),
            podcast: summarizeResult(podcastResult, {
                clipDurationSeconds: 10,
                sourceAudioUrl: PODCAST_AUDIO_URL,
                sourcePageUrl: PODCAST_PAGE_URL,
            }),
        };

        if (process.env.TAVERN_CORTEX_LIVE_REAL_SMOKE_OUTPUT) {
            await writeFile(
                process.env.TAVERN_CORTEX_LIVE_REAL_SMOKE_OUTPUT,
                `${JSON.stringify(summary, null, 2)}\n`
            );
        }
    }, 240_000);
});

async function download(url: string, filePath: string): Promise<void> {
    await run('curl', ['-L', '--fail', '-o', filePath, url]);
}

async function downloadRange(url: string, filePath: string, range: string): Promise<void> {
    await run('curl', ['-L', '--fail', '--range', range, '-o', filePath, url]);
}

async function trimAudioToWav(inputPath: string, outputPath: string): Promise<void> {
    await run('ffmpeg', [
        '-y',
        '-i',
        inputPath,
        '-t',
        '10',
        '-ar',
        '16000',
        '-ac',
        '1',
        outputPath,
    ]);
}

async function expectPersistedContent(result: CortexImportResult, expected: RegExp): Promise<void> {
    const page = await getCortexPage(getCortexDb(), result.page.slug);
    expect(page?.compiledTruth).toMatch(expected);
    expect(result.files).toHaveLength(1);
    expect(result.normalizedContent).toMatch(expected);
}

function summarizeResult(result: CortexImportResult, source: Record<string, unknown>) {
    return {
        fileCount: result.files.length,
        metadata: result.page.frontmatter.metadata,
        normalizedContent: result.normalizedContent,
        pageSlug: result.page.slug,
        source,
        sourceKind: result.sourceRef.kind,
    };
}

function base64Buffer(value: Uint8Array): string {
    return Buffer.from(value).toString('base64');
}
