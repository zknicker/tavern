import type { Page } from '@playwright/test';
import { createTavernClient } from '@tavern/sdk';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

// Regression: a live turn used to evict loaded history rows (live-progress
// trim plus tail-window slide), draining old turns' work evidence until the
// completion refetch restored them. Loaded history must only grow while the
// chat stays open. Tool work now lives in the turn details drawer, so the
// oracle is the first turn's drawer: every seeded step must survive a later
// working turn, and no hidden-entries counter may appear.
test('keeps loaded history and an open old work drawer stable through a live turn', async ({
    page,
}) => {
    test.setTimeout(180_000);

    await page.goto('/overview');
    await fillComposer(
        page,
        '#home-prompt',
        'Tool progress qa check. Read `QA_KICKOFF_TASK.md`, then reply exactly `QA_WINDOW_T1_OK`.'
    );
    await page.getByRole('button', { name: 'Start chat' }).click();
    const chatId = await waitForRealChatRoute(page);
    await expect(transcriptParagraph(page, 'QA_WINDOW_T1_OK')).toBeVisible({ timeout: 60_000 });

    await sendFollowUp(page, {
        expectedReply: 'QA_WINDOW_T2_OK',
        prompt: 'Follow-up chat turn marker. Reply exactly `QA_WINDOW_T2_OK`.',
    });

    // Give the first turn's drawer several steps and the chat a meaty work
    // log so eviction regressions have something visible to drain.
    await seedActivities({ chatId, count: 10, prefix: 'a', turn: 'first' });
    await seedActivities({ chatId, count: 40, prefix: 'b', turn: 'last' });

    await page.reload();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T2_OK')).toBeVisible({ timeout: 45_000 });

    // The first turn's drawer shows all of its seeded work up front.
    await openTurnDetails(page, 'first');
    await expandDrawerGroups(page);
    await expect(page.getByRole('dialog').getByText('Seed tool a0', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Seed tool a9', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await composer.fill(
        'Run the slow QA command against `QA_KICKOFF_TASK.md`, then reply exactly `QA_WINDOW_T3_OK`.'
    );
    await composer.press('Enter');
    await expect(transcriptParagraph(page, 'QA_WINDOW_T3_OK')).toBeVisible({ timeout: 90_000 });

    // The live turn must not have evicted the first turn's loaded work.
    await openTurnDetails(page, 'first');
    await expandDrawerGroups(page);
    await expect(page.getByRole('dialog').getByText('Seed tool a0', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Seed tool a9', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Loaded history must not shrink behind a hidden-entries counter either.
    await expect(page.getByText(/older (?:entry|entries)/)).toHaveCount(0);
});

function runtimeClient() {
    return createTavernClient({
        baseUrl: requiredEnv('TAVERN_RUNTIME_URL'),
        token: process.env.TAVERN_RUNTIME_TOKEN?.trim() || undefined,
    });
}

async function seedActivities(input: {
    chatId: string;
    count: number;
    prefix: string;
    turn: 'first' | 'last';
}) {
    if (input.count === 0) {
        return;
    }

    const client = runtimeClient();
    const { responses } = await client.chat.responses(input.chatId, { limit: 20 });
    const ordered = [...responses].sort(
        (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)
    );
    const response = input.turn === 'first' ? ordered[0] : ordered.at(-1);

    if (!response) {
        throw new Error(`Expected a ${input.turn} response.`);
    }

    // Stamp the seeds like real turn activity: run identity from the owning
    // response, and timestamps inside the turn's own span. The mock turns
    // complete in well under a second, so offsets past ~50ms can cross into
    // the next turn's timeline region and split the seeds out of this
    // turn's drawer.
    const runtimeMetadata =
        response.metadata &&
        typeof response.metadata === 'object' &&
        !Array.isArray(response.metadata) &&
        (response.metadata as Record<string, unknown>).runtime &&
        typeof (response.metadata as Record<string, unknown>).runtime === 'object'
            ? ((response.metadata as Record<string, unknown>).runtime as Record<string, unknown>)
            : {};
    const base = Date.parse(response.created_at) + 5;

    for (let index = 0; index < input.count; index += 1) {
        await client.chat.upsertResponseActivity(input.chatId, response.id, {
            artifact_ids: [],
            completed_at: new Date(base + index).toISOString(),
            detail: `Seed detail ${input.prefix}${index}`,
            id: `act_seed_${input.prefix}_${index}`,
            kind: 'tool_call',
            metadata: {
                runtime: {
                    ...runtimeMetadata,
                    toolCallId: `seed_${input.prefix}_${index}`,
                    toolName: 'seed_tool',
                },
                tool: { arguments: { index }, name: 'seed_tool', result: 'ok' },
            },
            started_at: new Date(base + index).toISOString(),
            status: 'completed',
            title: `Seed tool ${input.prefix}${index}`,
        });
    }
}

// Open a specific turn's details drawer; the affordance is hover-revealed,
// so force past the opacity gate.
async function openTurnDetails(page: Page, which: 'first' | 'last') {
    const details = page.getByRole('button', { name: 'View turn details' });
    const trigger = which === 'first' ? details.first() : details.last();
    await trigger.click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
}

// Expand the collapsed count-summary groups inside the drawer. Tool inspect
// triggers also carry aria-expanded; they open dialogs, so only headers
// without popups qualify.
async function expandDrawerGroups(page: Page) {
    for (let pass = 0; pass < 6; pass += 1) {
        const headers = page
            .getByRole('dialog')
            .locator('button[aria-expanded="false"]:not([aria-haspopup])');
        let clicked = false;

        for (const header of await headers.all()) {
            await header.click();
            clicked = true;
        }

        if (!clicked) {
            return;
        }
    }
}

function requiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} is required for this spec.`);
    }

    return value;
}

async function sendFollowUp(
    page: Page,
    { expectedReply, prompt }: { expectedReply: string; prompt: string }
) {
    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });

    await composer.fill(prompt);
    await composer.press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 45_000 });
}

function transcriptParagraph(page: Page, text: string) {
    return page.locator('main p').filter({ hasText: new RegExp(`^${text}$`) });
}

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/chats/')[1];

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return chatId;
}
