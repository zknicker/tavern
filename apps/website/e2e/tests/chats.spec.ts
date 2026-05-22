import type { Page } from '@playwright/test';
import { createTavernClient } from '@tavern/sdk';
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
    test.setTimeout(90_000);

    await startChat(page, {
        expectedReply: 'QA_TOOL_PROGRESS_OK',
        prompt: 'Tool progress qa check. Read `QA_KICKOFF_TASK.md`, then reply exactly `QA_TOOL_PROGRESS_OK`.',
    });

    await openWorkedActivity(page);
    await openFirstToolDetail(page);

    await expect(page.getByText('Used', { exact: true }).first()).toBeVisible();
    await expect(
        page.getByText('read from QA_KICKOFF_TASK.md', { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText('Tool details not available.')).toHaveCount(0);
    await expect(page.getByText('Arguments', { exact: true })).toBeVisible();
    await expect(page.getByText('Result', { exact: true })).toBeVisible();

    await page.reload();

    await expect(transcriptParagraph(page, 'QA_TOOL_PROGRESS_OK')).toBeVisible({
        timeout: 45_000,
    });
    await openWorkedActivity(page);
    await openFirstToolDetail(page);

    await expect(page.getByText('Tool details not available.')).toHaveCount(0);
    await expect(page.getByText('Arguments', { exact: true })).toBeVisible();
    await expect(page.getByText('Result', { exact: true })).toBeVisible();
});

test('renders durable artifacts after reload', async ({ page }) => {
    const chatId = await startChat(page, {
        expectedReply: 'QA_ARTIFACT_BASELINE_OK',
        prompt: 'Artifact baseline marker. Reply exactly `QA_ARTIFACT_BASELINE_OK`.',
    });
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL;

    if (!runtimeUrl) {
        throw new Error('TAVERN_RUNTIME_URL is required for artifact e2e coverage.');
    }

    await upsertRuntimeArtifact({ chatId, runtimeUrl });

    await page.reload();

    await openWorkedActivity(page);
    await expect(page.getByText('Captured artifact', { exact: true })).toBeVisible({
        timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByText('document', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('E2E artifact reload proof', { exact: true })).toBeVisible();
});

test('renders durable response activity kinds after reload', async ({ page }) => {
    const chatId = await startChat(page, {
        expectedReply: 'QA_ACTIVITY_KIND_BASELINE_OK',
        prompt: 'Activity kind baseline marker. Reply exactly `QA_ACTIVITY_KIND_BASELINE_OK`.',
    });
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL;

    if (!runtimeUrl) {
        throw new Error('TAVERN_RUNTIME_URL is required for activity kind e2e coverage.');
    }

    await upsertRuntimeActivityKinds({ chatId, runtimeUrl });

    await page.reload();

    await openWorkedActivity(page);
    await expect(page.getByText('Planning diagnostic', { exact: true })).toBeVisible({
        timeout: 15_000,
    });
    await expect(page.getByText('Reasoning diagnostic', { exact: true })).toBeVisible();
    await expect(page.getByText('Assistant preamble diagnostic', { exact: true })).toBeVisible();
    await expect(page.getByText('Approval diagnostic', { exact: true })).toBeVisible();
    await expect(page.getByText('Artifact diagnostic', { exact: true })).toBeVisible();
    await expect(page.getByText('Tool diagnostic', { exact: true })).toBeVisible();
});

async function upsertRuntimeArtifact(input: { chatId: string; runtimeUrl: string }) {
    const client = createTavernClient({ baseUrl: input.runtimeUrl });
    const responsePage = await client.chat.responses(input.chatId, { limit: 50 });
    const responseId = responsePage.responses.at(-1)?.id;

    if (!responseId) {
        throw new Error(`Expected chat ${input.chatId} to have a response before artifact write.`);
    }

    await client.chat.upsertArtifact(input.chatId, {
        content_text: 'Artifact body from the e2e runtime chat API.',
        id: 'art_e2e_reload',
        kind: 'document',
        response_id: responseId,
        title: 'E2E artifact reload proof',
    });
}

async function upsertRuntimeActivityKinds(input: { chatId: string; runtimeUrl: string }) {
    const client = createTavernClient({ baseUrl: input.runtimeUrl });
    const responsePage = await client.chat.responses(input.chatId, { limit: 50 });
    const responseId = responsePage.responses.at(-1)?.id;

    if (!responseId) {
        throw new Error(`Expected chat ${input.chatId} to have a response before activity writes.`);
    }

    const startedAt = new Date().toISOString();
    const activity = [
        { id: 'act_e2e_planning', kind: 'planning', title: 'Planning diagnostic' },
        { id: 'act_e2e_reasoning', kind: 'reasoning', title: 'Reasoning diagnostic' },
        { id: 'act_e2e_message', kind: 'message', title: 'Assistant preamble diagnostic' },
        { id: 'act_e2e_approval', kind: 'approval', title: 'Approval diagnostic' },
        { id: 'act_e2e_artifact', kind: 'artifact', title: 'Artifact diagnostic' },
        { id: 'act_e2e_tool', kind: 'tool_call', title: 'Tool diagnostic' },
    ] as const;

    for (const step of activity) {
        try {
            await client.chat.upsertResponseActivity(input.chatId, responseId, {
                artifact_ids: [],
                detail: `${step.title} detail`,
                id: step.id,
                kind: step.kind,
                metadata:
                    step.kind === 'tool_call'
                        ? {
                              runtime: {
                                  toolCallId: 'tool_call_e2e',
                                  toolName: 'diagnostic_tool',
                              },
                              tool: {
                                  arguments: { input: 'e2e' },
                                  name: 'diagnostic_tool',
                                  result: 'ok',
                              },
                          }
                        : {},
                started_at: startedAt,
                status: 'completed',
                title: step.title,
            });
        } catch (error) {
            throw new Error(
                `Failed to upsert diagnostic activity ${step.id}: ${JSON.stringify(error)}`
            );
        }
    }
}

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

    const chatId = await waitForRealChatRoute(page);
    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 45_000,
    });

    return chatId;
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

async function openWorkedActivity(page: Page) {
    const activity = page.getByRole('button', { name: /Worked for/i });
    await expect(activity).toBeVisible();
    if ((await activity.getAttribute('aria-expanded')) === 'false') {
        await activity.click();
    }
}

async function openFirstToolDetail(page: Page) {
    const tool = page.getByRole('button', { name: /Used read from QA_KICKOFF_TASK\.md/i }).first();
    await expect(tool).toBeVisible();
    await tool.click();
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
