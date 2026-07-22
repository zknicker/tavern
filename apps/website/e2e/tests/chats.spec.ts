import type { Page } from '@playwright/test';
import { createTavernClient } from '@tavern/sdk';
import { fillChatComposer, openAgentDm, sendAgentDmTurn } from '../support/agent-dm.ts';
import { expect, test } from '../support/test.ts';

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
    // Tool work lives in the turn details drawer, not the chat pane.
    await openTurnDetails(page);
    await expandWorkGroups(page);
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

    await expect(transcriptParagraph(page, 'QA_ARTIFACT_BASELINE_OK')).toBeVisible({
        timeout: 45_000,
    });
    // Artifact evidence lives in the turn details drawer, not the chat pane.
    await openTurnDetails(page);
    await expandWorkGroups(page);
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

    await startChat(page, {
        expectedReply: /^Here is the table\.\s+QA_RICH_RESPONSE_TABLE_SCROLL_FIRST_OK$/u,
        prompt: 'Rich response progress table scroll qa. Read `QA_KICKOFF_TASK.md`, render a tall table, and reply exactly `QA_RICH_RESPONSE_TABLE_SCROLL_FIRST_OK`.',
    });
    // Sends append at the bottom without re-anchoring: the viewport follows
    // the streaming reply and rests pinned at the transcript's end, so the
    // newest content (the tall reply's tail) is what stays in view.
    await expect
        .poll(() => transcriptDistanceFromBottom(page), { timeout: 15_000 })
        .toBeLessThan(160);

    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await expect(composer).toBeFocused();
    await composer.fill(
        'Second rich response progress table scroll qa. Read `QA_KICKOFF_TASK.md`, render a tall table, and reply exactly `QA_RICH_RESPONSE_TABLE_SCROLL_SECOND_OK`.'
    );
    await composer.press('Enter');

    // The follow tracks content growth: when a block of table content lands
    // in one frame, scrollTop legitimately steps by that block's height to
    // stay pinned, so per-step smoothness is not the contract here — staying
    // pinned to the end is.
    await expect(
        transcriptParagraph(
            page,
            /^Here is the table\.\s+QA_RICH_RESPONSE_TABLE_SCROLL_SECOND_OK$/u
        )
    ).toBeVisible({ timeout: 45_000 });

    // The follow rests pinned at the end again after the second reply lands —
    // no jump affordance needed to reach the latest content.
    await expect
        .poll(() => transcriptDistanceFromBottom(page), { timeout: 15_000 })
        .toBeLessThan(160);

    // Narration lives in the turn details drawer once a turn completes.
    await openTurnDetails(page);
    await expect(
        page
            .getByRole('dialog')
            .getByText(/Investigating variance/)
            .first()
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

function runtimeToken() {
    return process.env.TAVERN_RUNTIME_TOKEN?.trim() || undefined;
}

function readResponseRuntime(metadata: unknown): Record<string, unknown> {
    const record =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? (metadata as Record<string, unknown>)
            : {};
    const runtime = record.runtime;

    return runtime && typeof runtime === 'object' && !Array.isArray(runtime)
        ? (runtime as Record<string, unknown>)
        : {};
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
    // Unique per invocation: the persistent DM is shared by every test in the
    // run, and an activity id stays bound to the response that first used it.
    const idSuffix = `${input.chatId.replace(/[^A-Za-z0-9_-]/gu, '_')}_${Date.now()}`;
    // Real turns always stamp run identity on activity; mirror that so the
    // rows group into the turn's drawer and pane narration suppression works.
    const responseRuntime = readResponseRuntime(responsePage.responses.at(-1)?.metadata);
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
                                  ...responseRuntime,
                                  toolCallId: 'tool_call_e2e',
                                  toolName: 'diagnostic_tool',
                              },
                              tool: {
                                  arguments: { input: 'e2e' },
                                  name: 'diagnostic_tool',
                                  result: 'ok',
                              },
                          }
                        : { runtime: responseRuntime },
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

    await openAgentDm(page);
    await fillChatComposer(page, 'Empty response exhaustion qa check. Read `QA_KICKOFF_TASK.md`.');
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(
        transcriptParagraph(page, 'No reply: the model returned empty content.')
    ).toBeVisible({
        timeout: 60_000,
    });
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

// Chats are persistent DMs and channels — turns run in the seeded agent DM.
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
    return await sendAgentDmTurn(page, { expectedReply, prompt });
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

// How far the transcript viewport rests above its scrollable end. Pinned at
// the end this is ~0; a large value means the newest content is below the
// fold.
async function transcriptDistanceFromBottom(page: Page) {
    return await page.evaluate(() => {
        const viewport = document.querySelector('[data-slot="message-scroller-viewport"]');

        if (!(viewport instanceof HTMLElement)) {
            return Number.POSITIVE_INFINITY;
        }

        return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    });
}
