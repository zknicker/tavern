import type { Page } from '@playwright/test';
import { createTavernClient } from '@tavern/sdk';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

const optimisticVisibleLimitMs = 750;

test.describe.configure({ timeout: 120_000 });

test('runs a chat turn through the agent engine and renders the assistant reply', async ({
    page,
}) => {
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

test('renders Runtime-projected tool activity after reload', async ({ page }) => {
    test.setTimeout(90_000);

    const chatId = await startChat(page, {
        expectedReply: 'QA_TOOL_ACTIVITY_OK',
        prompt: 'Tool activity baseline marker. Reply exactly `QA_TOOL_ACTIVITY_OK`.',
    });
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL;

    if (!runtimeUrl) {
        throw new Error('TAVERN_RUNTIME_URL is required for activity e2e coverage.');
    }

    await upsertRuntimeActivityKinds({ chatId, runtimeUrl });
    await page.reload();

    await expect(transcriptParagraph(page, 'QA_TOOL_ACTIVITY_OK')).toBeVisible({
        timeout: 45_000,
    });
    await openWorkedActivity(page);
    await expect(page.getByRole('button', { name: /Tool diagnostic/u })).toBeVisible();
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

    // Work and thinking activity live in the turn details drawer, not the
    // chat pane.
    await openTurnDetails(page);
    await openWorkedActivity(page);
    await openThinkingActivity(page);
    await expect(page.getByText('Thinking diagnostic detail', { exact: true })).toBeVisible({
        timeout: 15_000,
    });
    await expect(
        page.getByText('Assistant preamble diagnostic detail', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Artifact diagnostic/u })).toBeVisible();
    await expect(page.getByRole('button', { name: /Tool diagnostic/u })).toBeVisible();
});

test('keeps Rich Response table generation pinned to the latest reply', async ({ page }) => {
    test.setTimeout(90_000);
    await enableScrollDebug(page);

    await startChat(page, {
        expectedReply: /^Here is the table\.\s+QA_RICH_RESPONSE_TABLE_SCROLL_FIRST_OK$/u,
        prompt: 'Rich response progress table scroll qa. Read `QA_KICKOFF_TASK.md`, render a tall table, and reply exactly `QA_RICH_RESPONSE_TABLE_SCROLL_FIRST_OK`.',
    });
    await expect(page.getByText('Investigating variance').first()).toBeVisible();
    await expect
        .poll(() => chatTranscriptBottomDistance(page), { timeout: 10_000 })
        .toBeLessThanOrEqual(4);

    const scrollSamples = await collectScrollSamplesDuring(page, async () => {
        await sendFollowUp(page, {
            expectedReply: /^Here is the table\.\s+QA_RICH_RESPONSE_TABLE_SCROLL_SECOND_OK$/u,
            prompt: 'Second rich response progress table scroll qa. Read `QA_KICKOFF_TASK.md`, render a tall table, and reply exactly `QA_RICH_RESPONSE_TABLE_SCROLL_SECOND_OK`.',
        });
    });

    const largestStep = getLargestScrollStep(scrollSamples);

    if (largestStep > 180) {
        throw new Error(
            `Expected smooth follow scroll step <= 180px, received ${largestStep}px. ${JSON.stringify(
                {
                    debugTail: await getScrollDebugTail(page),
                    scrollJump: getLargestScrollStepWindow(scrollSamples),
                    sampleCount: scrollSamples.length,
                }
            )}`
        );
    }

    await expect
        .poll(() => chatTranscriptBottomDistance(page), { timeout: 10_000 })
        .toBeLessThanOrEqual(4);
    await expect
        .poll(() => latestAgentEyesTailClearance(page), { timeout: 10_000 })
        .toBeGreaterThanOrEqual(8);
    await expect(page.getByRole('button', { name: 'Jump to latest message' })).toHaveCount(0);
});

function runtimeToken() {
    return process.env.TAVERN_RUNTIME_TOKEN?.trim() || undefined;
}

async function upsertRuntimeArtifact(input: { chatId: string; runtimeUrl: string }) {
    const client = createTavernClient({ baseUrl: input.runtimeUrl, token: runtimeToken() });
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
    const client = createTavernClient({ baseUrl: input.runtimeUrl, token: runtimeToken() });
    const responsePage = await client.chat.responses(input.chatId, { limit: 50 });
    const responseId = responsePage.responses.at(-1)?.id;

    if (!responseId) {
        throw new Error(`Expected chat ${input.chatId} to have a response before activity writes.`);
    }

    const startedAt = new Date().toISOString();
    const idSuffix = input.chatId.replace(/[^A-Za-z0-9_-]/gu, '_');
    const activity = [
        { id: `act_e2e_reasoning_${idSuffix}`, kind: 'reasoning', title: 'Thinking diagnostic' },
        {
            id: `act_e2e_message_${idSuffix}`,
            kind: 'message',
            title: 'Assistant preamble diagnostic',
        },
        { id: `act_e2e_artifact_${idSuffix}`, kind: 'artifact', title: 'Artifact diagnostic' },
        { id: `act_e2e_tool_${idSuffix}`, kind: 'tool_call', title: 'Tool diagnostic' },
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

test('renders an agent no-content turn as a durable assistant diagnostic', async ({ page }) => {
    test.setTimeout(75_000);

    await page.goto('/overview');

    await fillComposer(
        page,
        '#home-prompt',
        'Empty response exhaustion qa check. Read `QA_KICKOFF_TASK.md`.'
    );
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await page.reload();

    await expect(
        transcriptParagraph(page, 'No reply: the model returned empty content.')
    ).toBeVisible({
        timeout: 60_000,
    });
    await expect(page.getByText('Model returned no content after all retries.')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Worked for .* Agent turn failed/i })
    ).toHaveCount(0);
});

test('new chat renders optimistic state, final reply, and hover metadata without latency regressions', async ({
    page,
}) => {
    test.setTimeout(90_000);

    await enableChatTiming(page);

    await page.goto('/overview');

    const expectedReply = 'QA_CHAT_LATENCY_OK';
    const prompt = `Latency regression marker. Reply exactly \`${expectedReply}\`.`;
    await fillComposer(page, '#home-prompt', prompt);
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
    expectElapsedWithin(optimisticTiming, 'optimistic-sidebar-visible', optimisticVisibleLimitMs);
    expectElapsedWithin(
        optimisticTiming,
        'optimistic-user-message-visible',
        optimisticVisibleLimitMs
    );
    expectElapsedWithin(optimisticTiming, 'thinking-visible', optimisticVisibleLimitMs);

    await waitForRealChatRoute(page);
    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toBeVisible({ timeout: 10_000 });
    await expect(finalReply).toHaveCount(1);

    await waitForChatTiming(page, ['final-message-visible']);

    const metadata = await getAgentHoverMetadata(page);
    if (metadata) {
        expect(metadata.opacity).toBe('0');
    }
});

async function startChat(
    page: Page,
    {
        expectedReply,
        prompt,
    }: {
        expectedReply: string | RegExp;
        prompt: string;
    }
) {
    await page.goto('/overview');

    await fillComposer(page, '#home-prompt', prompt);
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
        expectedReply: string | RegExp;
        prompt: string;
    }
) {
    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await expect(composer).toBeFocused();

    await composer.fill(prompt);
    await composer.press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 45_000,
    });
}

async function openTurnDetails(page: Page) {
    const details = page.getByRole('button', { name: 'View turn details' }).last();
    // The affordance is hover-revealed; force past the opacity gate.
    await details.click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
}

async function openWorkedActivity(page: Page) {
    const activity = page.getByRole('button', { name: workGroupHeaderName }).first();
    await expect(activity).toBeVisible();
    if ((await activity.getAttribute('aria-expanded')) === 'false') {
        await activity.click();
    }
    await expandWorkGroups(page);
}

// Work rows render inside collapsed count-summary groups ("Read a file",
// "Used a tool, read a file"); their content stays aria-hidden and inert
// until the group header is expanded.
const workGroupHeaderName =
    /^(?:Using|Used|Reading|Read|Running|Ran|Editing|Edited|Searching|Searched|Rendering|Rendered|Thinking|Worked)\b(?! for)/i;

async function expandWorkGroups(page: Page) {
    for (let pass = 0; pass < 5; pass += 1) {
        const headers = page.getByRole('button', { name: workGroupHeaderName });
        let clicked = false;

        for (const header of await headers.all()) {
            if ((await header.getAttribute('aria-expanded')) === 'false') {
                await header.click();
                clicked = true;
            }
        }

        if (!clicked) {
            return;
        }
    }
}

async function openThinkingActivity(page: Page) {
    const activity = page.getByRole('button', { name: /^Thinking$/u }).first();
    await expect(activity).toBeVisible();
    if ((await activity.getAttribute('aria-expanded')) === 'false') {
        await activity.click();
    }
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

async function enableScrollDebug(page: Page) {
    await page.addInitScript(() => {
        (
            window as typeof window & {
                __TAVERN_SCROLL_DEBUG__?: unknown[];
            }
        ).__TAVERN_SCROLL_DEBUG__ = [];
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
    await page.waitForURL((url) => /^\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/chats/')[1] ?? null;

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return chatId;
}

async function chatTranscriptBottomDistance(page: Page) {
    return page.evaluate(() => {
        const viewport = Array.from(document.querySelectorAll('main div')).find((element) => {
            if (!(element instanceof HTMLElement)) {
                return false;
            }

            const style = window.getComputedStyle(element);
            return style.overflowY === 'auto' && element.scrollHeight > element.clientHeight;
        });

        if (!(viewport instanceof HTMLElement)) {
            throw new Error('Chat scroll viewport not found.');
        }

        return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    });
}

async function latestAgentEyesTailClearance(page: Page) {
    return page.evaluate(() => {
        const viewport = Array.from(document.querySelectorAll('main div')).find((element) => {
            if (!(element instanceof HTMLElement)) {
                return false;
            }

            const style = window.getComputedStyle(element);
            return style.overflowY === 'auto' && element.scrollHeight > element.clientHeight;
        });
        const agentEyes = Array.from(
            document.querySelectorAll('output[aria-label^="Agent "]')
        ).filter((element): element is HTMLElement => element instanceof HTMLElement);
        const latestAgentEyes = agentEyes.at(-1);

        if (!(viewport instanceof HTMLElement && latestAgentEyes)) {
            throw new Error('Chat presence geometry not found.');
        }

        return (
            viewport.getBoundingClientRect().bottom - latestAgentEyes.getBoundingClientRect().bottom
        );
    });
}

async function collectScrollSamplesDuring(page: Page, action: () => Promise<void>) {
    const handle = await page.evaluateHandle(() => {
        const samples: number[] = [];
        let frameId = 0;
        const readScrollTop = () => {
            const viewport = Array.from(document.querySelectorAll('main div')).find((element) => {
                if (!(element instanceof HTMLElement)) {
                    return false;
                }

                const style = window.getComputedStyle(element);
                return style.overflowY === 'auto' && element.scrollHeight > element.clientHeight;
            });

            if (viewport instanceof HTMLElement) {
                samples.push(viewport.scrollTop);
            }

            frameId = window.requestAnimationFrame(readScrollTop);
        };

        frameId = window.requestAnimationFrame(readScrollTop);

        return {
            read: () => samples,
            stop: () => window.cancelAnimationFrame(frameId),
        };
    });

    try {
        await action();
        return await handle.evaluate((collector) => {
            collector.stop();
            return collector.read();
        });
    } finally {
        await handle.dispose();
    }
}

function getLargestScrollStep(samples: number[]) {
    let largestStep = 0;
    let previous = samples[0] ?? 0;

    for (const sample of samples.slice(1)) {
        largestStep = Math.max(largestStep, sample - previous);
        previous = sample;
    }

    return largestStep;
}

function getLargestScrollStepWindow(samples: number[]) {
    let largestStep = 0;
    let largestIndex = 0;
    let previous = samples[0] ?? 0;

    for (const [offset, sample] of samples.slice(1).entries()) {
        const step = sample - previous;

        if (step > largestStep) {
            largestStep = step;
            largestIndex = offset + 1;
        }

        previous = sample;
    }

    return {
        largestIndex,
        largestStep,
        samples: samples.slice(Math.max(largestIndex - 6, 0), largestIndex + 7),
    };
}

async function getScrollDebugTail(page: Page) {
    return page.evaluate(() => {
        const debug = (
            window as typeof window & {
                __TAVERN_SCROLL_DEBUG__?: unknown[];
            }
        ).__TAVERN_SCROLL_DEBUG__;

        return debug?.slice(-24) ?? [];
    });
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
