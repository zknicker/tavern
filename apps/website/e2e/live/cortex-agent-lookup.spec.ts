import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import {
    type CapturedOpenClawGatewayEvent,
    readCapturedGatewayChatId,
    startOpenClawGatewayCapture,
} from '../openclaw/gateway-capture.ts';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test('uses Cortex before answering a seeded long-term memory question', async ({ page }) => {
    test.setTimeout(180_000);

    const runtimeUrl = requireRuntimeUrl();
    const marker = `QA-CORTEX-FIRST-${Date.now()}`;
    const expectedColor = 'ultraviolet';
    const title = `Cortex First Lookup ${marker}`;
    const capture = await startOpenClawGatewayCapture('cortex-agent-lookup');

    await postRuntimeJson(`${runtimeUrl}/cortex/capture`, {
        content: `For marker ${marker}, the QA Cortex lookup color is ${expectedColor}. This fact exists only in Tavern Cortex for the live brain-first lookup smoke.`,
        source: {
            actorId: 'e2e-cortex-agent-lookup',
            actorKind: 'system',
            url: 'tavern-e2e:cortex-agent-lookup',
        },
        tags: ['e2e', 'cortex', 'brain-first'],
        title,
        type: 'note',
    });

    try {
        await page.goto('/dashboard/overview');

        await fillComposer(
            page,
            '#home-prompt',
            `What is the QA Cortex lookup color for marker ${marker}? Use long-term memory if needed. Reply with the marker and color only.`
        );
        await page.getByRole('button', { name: 'Start chat' }).click();

        const chatId = normalizeGatewayChatId(await waitForRealChatRoute(page));
        const sessionEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId && Boolean(readSessionKey(event)),
            60_000
        );
        const sessionKey = readSessionKey(sessionEvent);

        if (!sessionKey) {
            throw new Error('Expected Cortex agent lookup smoke to have an OpenClaw session key.');
        }

        await capture.waitForEvent(
            (event) => readCapturedGatewayChatId(event) === chatId && isDoneSessionEvent(event),
            120_000
        );

        await expect(page.getByRole('alert').filter({ hasText: 'Agent turn failed' })).toHaveCount(
            0
        );
        await expect(
            page
                .locator('main p')
                .filter({ hasText: new RegExp(`${marker}.*${expectedColor}`, 'i') })
        ).toBeVisible({ timeout: 45_000 });

        const trajectory = await waitForTrajectoryRecords(sessionKey);
        const cortexToolCall = trajectory.find((record) => isCortexLookupToolCall(record));
        const finalAnswer = trajectory.find((record) =>
            modelCompletedAnswerIncludes(record, marker, expectedColor)
        );

        expect(cortexToolCall).toBeTruthy();
        expect(finalAnswer).toBeTruthy();
        expect(readSequence(finalAnswer)).toBeGreaterThan(readSequence(cortexToolCall));
        expect(trajectory.some((record) => isCortexLookupToolResultForMarker(record, marker))).toBe(
            true
        );
    } finally {
        capture.snapshot('cortex-agent-lookup');
        capture.close();
    }
});

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/dashboard\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/dashboard/chats/')[1] ?? null;

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return chatId;
}

function normalizeGatewayChatId(chatId: string) {
    const decoded = decodeURIComponent(chatId);

    return decoded.split(':').at(-1) ?? decoded;
}

function readSessionKey(event: CapturedOpenClawGatewayEvent) {
    const payload = asRecord(event.payload);
    const sessionKey = payload.sessionKey ?? payload.key ?? asRecord(payload.session).sessionKey;

    return typeof sessionKey === 'string' && sessionKey.trim() ? sessionKey : null;
}

function isDoneSessionEvent(event: CapturedOpenClawGatewayEvent) {
    if (event.event !== 'sessions.changed') {
        return false;
    }

    const payload = asRecord(event.payload);
    const status = typeof payload.status === 'string' ? payload.status : null;
    const sessionStatus =
        typeof asRecord(payload.session).status === 'string'
            ? asRecord(payload.session).status
            : null;

    return payload.phase === 'end' && (status === 'done' || sessionStatus === 'done');
}

async function waitForTrajectoryRecords(sessionKey: string) {
    const sessionsDir = getOpenClawSessionsDir();

    for (let attempt = 0; attempt < 600; attempt += 1) {
        const entries = await readdir(sessionsDir).catch(() => []);

        for (const entry of entries) {
            if (!entry.endsWith('.trajectory.jsonl')) {
                continue;
            }

            const raw = await readFile(path.join(sessionsDir, entry), 'utf8').catch(() => '');

            if (!raw.includes(sessionKey)) {
                continue;
            }

            const records = raw
                .split(/\n/u)
                .filter(Boolean)
                .map(parseJsonLine)
                .filter((record): record is Record<string, unknown> => Boolean(record));

            if (records.some(isCortexLookupToolCall)) {
                return records;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`OpenClaw trajectory did not record Cortex lookup tool use for ${sessionKey}.`);
}

function getOpenClawSessionsDir() {
    const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
    const runtimeRoot = fileURLToPath(
        new URL(`../../../../.context/e2e/${runId}/tavern-runtime`, import.meta.url)
    );

    return path.join(runtimeRoot, 'openclaw', 'run', 'state', 'agents', 'main', 'sessions');
}

async function postRuntimeJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(`Runtime request failed (${response.status}): ${await response.text()}`);
    }
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function parseJsonLine(line: string) {
    try {
        return JSON.parse(line) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function isCortexLookupToolCall(record: Record<string, unknown>) {
    return (
        record.type === 'tool.call' &&
        ['cortex_get_page', 'cortex_recall', 'cortex_search'].includes(
            String(asRecord(record.data).name)
        )
    );
}

function isCortexLookupToolResultForMarker(record: Record<string, unknown>, marker: string) {
    return (
        record.type === 'tool.result' &&
        ['cortex_get_page', 'cortex_recall', 'cortex_search'].includes(
            String(asRecord(record.data).name)
        ) &&
        JSON.stringify(record).includes(marker)
    );
}

function modelCompletedAnswerIncludes(
    record: Record<string, unknown>,
    marker: string,
    expectedColor: string
) {
    if (record.type !== 'model.completed') {
        return false;
    }

    const assistantTexts = asRecord(record.data).assistantTexts;

    return (
        Array.isArray(assistantTexts) &&
        assistantTexts.some(
            (text) =>
                typeof text === 'string' &&
                text.includes(marker) &&
                text.toLowerCase().includes(expectedColor)
        )
    );
}

function readSequence(record: Record<string, unknown> | undefined) {
    const sequence = record?.seq;

    return typeof sequence === 'number' ? sequence : -1;
}

function requireRuntimeUrl() {
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL;

    if (!runtimeUrl) {
        throw new Error('TAVERN_RUNTIME_URL is required for Cortex agent lookup smoke.');
    }

    return runtimeUrl;
}
