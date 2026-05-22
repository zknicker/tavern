import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import {
    type CapturedOpenClawGatewayEvent,
    readCapturedGatewayChatId,
    readCapturedGatewayReplyText,
    startOpenClawGatewayCapture,
} from '../openclaw/gateway-capture.ts';
import { expect, test } from '../support/test.ts';

test('preserves Tavern chat session routing and renders one final reply', async ({ page }) => {
    test.setTimeout(120_000);

    const capture = await startOpenClawGatewayCapture('tavern-chat-contract');
    const expectedReply = `QA-TAVERN-CONTRACT-${Date.now()}`;

    try {
        await page.goto('/dashboard/overview');

        await page
            .locator('#home-prompt')
            .fill(`Tavern Gateway marker check. Use exact marker: \`${expectedReply}\`.`);
        await page.getByRole('button', { name: 'Start chat' }).click();

        const chatId = await waitForRealChatRoute(page);
        const sessionEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId && Boolean(readSessionKey(event)),
            60_000
        );
        const sessionKey = readSessionKey(sessionEvent);

        expect(sessionKey).toContain(`:tavern:channel:${chatId}`);
        expect(sessionKey).not.toMatch(/^agent:[^:]+:main$/);

        const finalEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId &&
                isVisibleFinalReplyEvent(event) &&
                readCapturedGatewayReplyText(event)?.trim() === expectedReply,
            90_000
        );

        expect(readCapturedGatewayReplyText(finalEvent)?.trim()).toBe(expectedReply);

        const finalReply = transcriptParagraph(page, expectedReply);
        await expect(finalReply).toBeVisible({ timeout: 45_000 });
        await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
        await expect(finalReply).toHaveCount(1);
        expect(
            capture.events().some((event) => event.event === 'plugin.tavern.message.created')
        ).toBe(false);
    } finally {
        capture.snapshot('tavern-chat-contract');
        capture.close();
    }
});

test('recovers accepted user message and active turn after hard reload', async ({ page }) => {
    test.setTimeout(150_000);

    const expectedReply = 'RECOVERED-SUBAGENT-OK';
    const prompt = `Subagent recovery worker reload qa check ${Date.now()}. Reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await page.locator('#home-prompt').fill(prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(page.getByRole('button', { name: /Working for/i })).toBeVisible({
        timeout: 30_000,
    });

    await page.reload();

    await expect(page.locator('main p').filter({ hasText: prompt })).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /Working for/i })).toBeVisible({
        timeout: 30_000,
    });
    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 90_000,
    });
});

test('renders live tool progress before the final reply', async ({ page }) => {
    test.setTimeout(240_000);

    const expectedReply = `LIVE-TOOL-PROGRESS-${Date.now()}`;
    const prompt = `Live tool progress qa check. Run the slow QA command, then reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await page.locator('#home-prompt').fill(prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toHaveCount(0);

    const liveActivity = page.getByRole('button', { name: /Working for/i });
    await expect(liveActivity).toBeVisible({ timeout: 30_000 });

    const liveToolEvidence = page
        .getByText(/QA_KICKOFF_TASK\.md|exec|run sleep 4|command sleep 4/i)
        .first();
    await expect(liveToolEvidence).toBeVisible({ timeout: 90_000 });
    await expect(finalReply).toHaveCount(0);

    await expect(finalReply).toBeVisible({ timeout: 90_000 });

    const completedActivity = page.getByRole('button', { name: /Worked for/i });
    await expect(completedActivity).toBeVisible({ timeout: 30_000 });
    await openActivityIfClosed(completedActivity);
    await expect(page.getByText(/QA_KICKOFF_TASK\.md|exec|run sleep 4/i).first()).toBeVisible({
        timeout: 10_000,
    });
});

test('renders model reasoning summaries in chat activity', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/dashboard/overview');

    await page.locator('#home-prompt').fill('QA thinking visibility check max');
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    await expect(page.getByText('THINKING-MAX-OK', { exact: true }).first()).toBeVisible({
        timeout: 90_000,
    });

    await openActivityIfClosed(page.getByRole('button', { name: /Worked for/i }));
    await expect(page.getByText(/Reasoning/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(
        page.getByText(/I should show this reasoning summary in Tavern\./).first()
    ).toBeVisible({ timeout: 10_000 });
});

test('preserves one user message and tool progress across repeated hard reloads', async ({
    page,
}) => {
    test.setTimeout(180_000);

    const prompt = `Reload-heavy tool turn qa ${Date.now()}. Read \`QA_KICKOFF_TASK.md\`, then summarize the evidence.`;

    await page.goto('/dashboard/overview');

    await page.locator('#home-prompt').fill(prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(page.getByRole('button', { name: /Working for/i })).toBeVisible({
        timeout: 30_000,
    });

    await page.reload();
    await expect(page.locator('main p').filter({ hasText: prompt })).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: /Working for/i })).toBeVisible({
        timeout: 30_000,
    });

    await page.reload();
    await expect(page.locator('main p').filter({ hasText: prompt })).toHaveCount(1, {
        timeout: 30_000,
    });
    const activity = page.getByRole('button', { name: /Work(?:ing|ed) for/i });
    await expect(activity).toBeVisible({ timeout: 60_000 });
    await openActivityIfClosed(activity);
    await expect(page.getByText(/QA_KICKOFF_TASK\.md/i).first()).toBeVisible({
        timeout: 60_000,
    });

    await page.reload();
    await expect(page.locator('main p').filter({ hasText: prompt })).toHaveCount(1, {
        timeout: 30_000,
    });
    const finalReply = transcriptParagraph(page, /Evidence snippet: # QA kickoff task/i);
    await expect(finalReply).toBeVisible({
        timeout: 90_000,
    });
    await expect(finalReply).toHaveCount(1);
    await expect(page.getByLabel('Agent is thinking')).toBeHidden({ timeout: 30_000 });
    await expectOpenClawTranscriptIdentity(prompt);
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

    return decodeURIComponent(chatId);
}

async function openActivityIfClosed(activity: ReturnType<Page['getByRole']>) {
    if ((await activity.getAttribute('aria-expanded')) === 'false') {
        await activity.click();
    }
}

function isVisibleFinalReplyEvent(event: CapturedOpenClawGatewayEvent) {
    if (event.event === 'session.message') {
        return asRecord(asRecord(event.payload).message).role === 'assistant'
            ? Boolean(readCapturedGatewayReplyText(event))
            : false;
    }

    if (event.event !== 'chat') {
        return false;
    }

    const payload = asRecord(event.payload);
    const state = typeof payload.state === 'string' ? payload.state : null;

    if (!(state === 'completed' || state === 'done' || state === 'final')) {
        return false;
    }

    return Boolean(readCapturedGatewayReplyText(event));
}

function transcriptParagraph(page: Page, text: string | RegExp) {
    return page.locator('main p').filter({
        hasText: typeof text === 'string' ? exactTextRegex(text) : text,
    });
}

function exactTextRegex(text: string) {
    return new RegExp(`^${escapeRegExp(text)}$`);
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readSessionKey(event: CapturedOpenClawGatewayEvent) {
    const payload = asRecord(event.payload);
    const sessionKey = payload.sessionKey ?? payload.key ?? asRecord(payload.session).sessionKey;

    return typeof sessionKey === 'string' && sessionKey.trim() ? sessionKey : null;
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

async function expectOpenClawTranscriptIdentity(prompt: string) {
    const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
    const runtimeRoot = fileURLToPath(
        new URL(`../../../../.context/e2e/${runId}/tavern-runtime`, import.meta.url)
    );

    const sessionsDir = path.join(
        runtimeRoot,
        'openclaw',
        'run',
        'state',
        'agents',
        'main',
        'sessions'
    );

    for (let attempt = 0; attempt < 300; attempt += 1) {
        const entries = await readdir(sessionsDir).catch(() => []);

        for (const entry of entries) {
            if (!entry.endsWith('.jsonl') || entry.endsWith('.trajectory.jsonl')) {
                continue;
            }

            const raw = await readFile(path.join(sessionsDir, entry), 'utf8').catch(() => '');

            if (!(raw.includes(prompt) && raw.includes('"acceptedMessageId":"msg_'))) {
                continue;
            }

            const userRows = raw
                .split(/\n/)
                .filter(Boolean)
                .map((line) => JSON.parse(line))
                .filter(
                    (record) =>
                        record?.type === 'message' &&
                        record.message?.role === 'user' &&
                        JSON.stringify(record).includes(prompt)
                );

            expect(userRows).toHaveLength(1);
            const message = asRecord(userRows[0].message);
            const metadata = asRecord(message.metadata);
            const tavern = asRecord(metadata.tavern);
            const acceptedMessageId = tavern.acceptedMessageId;

            expect(typeof acceptedMessageId).toBe('string');
            const durableMessageId = String(acceptedMessageId);

            expect(durableMessageId).toMatch(/^msg_/);
            expect(message.id).toBe(durableMessageId);
            expect(message.messageId).toBe(durableMessageId);
            expect(tavern.nonce).toBe(durableMessageId);
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('OpenClaw transcript did not preserve Tavern message identity.');
}
