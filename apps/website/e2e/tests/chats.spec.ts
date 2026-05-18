import type { Page } from '@playwright/test';
import {
    type CapturedOpenClawGatewayEvent,
    readCapturedGatewayChatId,
    readCapturedGatewayReplyText,
    startOpenClawGatewayCapture,
} from '../openclaw/gateway-capture.ts';
import { expect, test } from '../support/test.ts';

const optimisticVisibleLimitMs = 750;
const finalRenderAfterGatewayLimitMs = 1500;

test('runs a chat turn through OpenClaw and renders the assistant reply', async ({ page }) => {
    const expectedReply = 'QA_CHAT_TURN_OK';
    await startChat(page, {
        expectedReply,
        prompt: `Normal chat turn marker. Reply exactly \`${expectedReply}\`.`,
    });
});

test('runs a follow-up turn in an existing chat', async ({ page }) => {
    await startChat(page, {
        expectedReply: 'QA_FIRST_TURN_OK',
        prompt: 'Normal chat turn marker. Reply exactly `QA_FIRST_TURN_OK`.',
    });

    await sendFollowUp(page, {
        expectedReply: 'QA_FOLLOWUP_TURN_OK',
        prompt: 'Follow-up chat turn marker. Reply exactly `QA_FOLLOWUP_TURN_OK`.',
    });

    await expect(transcriptParagraph(page, 'QA_FIRST_TURN_OK')).toBeVisible();
    await expect(transcriptParagraph(page, 'QA_FOLLOWUP_TURN_OK')).toBeVisible();
});

test('renders tool progress and the final reply for a tool-using turn', async ({ page }) => {
    await startChat(page, {
        expectedReply: 'QA_TOOL_PROGRESS_OK',
        prompt: 'Tool progress qa check. Read `QA_KICKOFF_TASK.md`, then reply exactly `QA_TOOL_PROGRESS_OK`.',
    });

    const activity = page.getByRole('button', { name: /Worked for/i });
    await expect(activity).toBeVisible();
    await activity.click();

    await expect(page.getByText('Used', { exact: true }).first()).toBeVisible();
    await expect(
        page.getByText('read from QA_KICKOFF_TASK.md', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('Unable to load tool details.')).toHaveCount(0);
});

test('renders a failed turn as a top-level chat error', async ({ page }) => {
    test.setTimeout(75_000);

    await page.goto('/dashboard/overview');

    await page
        .locator('#home-prompt')
        .fill('Empty response exhaustion qa check. Read `QA_KICKOFF_TASK.md`.');
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    const failure = page.getByRole('alert').filter({ hasText: 'Agent turn failed' });
    await expect(failure).toBeVisible({ timeout: 60_000 });
    await expect(failure).toContainText('OpenClaw turn ended before producing a reply.');
    await expect(
        page.getByRole('button', { name: /Worked for .* Agent turn failed/i })
    ).toHaveCount(0);
});

test('new chat renders optimistic state, final reply, and hover metadata without latency regressions', async ({
    page,
}) => {
    test.setTimeout(90_000);

    await enableChatTiming(page);
    const capture = await startOpenClawGatewayCapture('chat-latency-regression');

    try {
        await page.goto('/dashboard/overview');

        const expectedReply = 'QA_CHAT_LATENCY_OK';
        const prompt = `Latency regression marker. Reply exactly \`${expectedReply}\`.`;
        await page.locator('#home-prompt').fill(prompt);
        await page.getByRole('button', { name: 'Start chat' }).click();
        await page.mouse.move(1650, 390);

        await expect(page).toHaveURL(/\/dashboard\/chats\/new$/);
        await expect(
            page.getByRole('link', { name: `${prompt} starting`, exact: true })
        ).toBeVisible();
        await expect(page.locator('main p').filter({ hasText: prompt })).toBeVisible();

        const optimisticTiming = await waitForChatTiming(page, [
            'optimistic-chat-visible',
            'optimistic-sidebar-visible',
            'optimistic-user-message-visible',
            'submit',
            'thinking-visible',
        ]);
        expectElapsedWithin(optimisticTiming, 'optimistic-chat-visible', optimisticVisibleLimitMs);
        expectElapsedWithin(
            optimisticTiming,
            'optimistic-sidebar-visible',
            optimisticVisibleLimitMs
        );
        expectElapsedWithin(
            optimisticTiming,
            'optimistic-user-message-visible',
            optimisticVisibleLimitMs
        );
        expectElapsedWithin(optimisticTiming, 'thinking-visible', optimisticVisibleLimitMs);

        const chatId = normalizeGatewayChatId(await waitForRealChatRoute(page));
        const finalEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId &&
                readCapturedGatewayReplyText(event) === expectedReply &&
                isVisibleFinalReplyEvent(event),
            60_000
        );

        const finalReply = transcriptParagraph(page, expectedReply);
        await expect(finalReply).toBeVisible({ timeout: 10_000 });
        await expect(finalReply).toHaveCount(1);

        const finalTiming = await waitForChatTiming(page, ['final-message-visible']);
        const finalEventAt = Date.parse(finalEvent.capturedAt);
        const finalRenderLagMs =
            finalTiming.marks['final-message-visible'].wallClockMs - finalEventAt;
        expect(finalRenderLagMs).toBeLessThanOrEqual(finalRenderAfterGatewayLimitMs);

        const metadata = await getAgentHoverMetadata(page);
        if (metadata) {
            expect(metadata.opacity).toBe('0');
        }
    } finally {
        capture.snapshot('latency');
        capture.close();
    }
});

async function startChat(
    page: Page,
    {
        expectedReply,
        prompt,
    }: {
        expectedReply: string;
        prompt: string;
    }
) {
    await page.goto('/dashboard/overview');

    await page.locator('#home-prompt').fill(prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 45_000,
    });
}

async function sendFollowUp(
    page: Page,
    {
        expectedReply,
        prompt,
    }: {
        expectedReply: string;
        prompt: string;
    }
) {
    const composer = page.getByRole('textbox', { name: /Ask for follow-up changes/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });

    await composer.fill(prompt);
    await composer.press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 45_000,
    });
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

async function enableChatTiming(page: Page) {
    await page.addInitScript(() => {
        window.__TAVERN_CHAT_TIMING__ = {
            enabled: true,
            events: [],
            marks: {},
        };
    });
}

async function waitForChatTiming(page: Page, names: string[]) {
    await page.waitForFunction(
        (expectedNames) => {
            const marks = window.__TAVERN_CHAT_TIMING__?.marks ?? {};
            return expectedNames.every((name) => marks[name as keyof typeof marks]);
        },
        names,
        { timeout: 15_000 }
    );

    return page.evaluate(() => window.__TAVERN_CHAT_TIMING__);
}

function expectElapsedWithin(
    timing: NonNullable<Awaited<ReturnType<typeof waitForChatTiming>>>,
    name: string,
    limitMs: number
) {
    const submit = timing.marks?.submit;
    const mark = timing.marks?.[name as keyof typeof timing.marks];

    expect(submit).toBeTruthy();
    expect(mark).toBeTruthy();
    expect((mark?.timestamp ?? 0) - (submit?.timestamp ?? 0)).toBeLessThanOrEqual(limitMs);
}

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

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

async function getAgentHoverMetadata(page: Page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="group-hover:opacity-100"]'))
            .map((element) => {
                const rect = element.getBoundingClientRect();

                return {
                    opacity: getComputedStyle(element).opacity,
                    text: element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '',
                    x: rect.x,
                    y: rect.y,
                };
            })
            .find((meta) => meta.text.includes('codex') || meta.text.includes('gpt'))
    );
}
