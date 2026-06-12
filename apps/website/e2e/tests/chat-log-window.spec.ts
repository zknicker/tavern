import type { Page } from '@playwright/test';
import { createTavernClient } from '@tavern/sdk';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

interface DrawerSample {
    expanded: string;
    hidden: string;
    panelHeight: number;
    sameNode: boolean;
    steps: string;
}

declare global {
    interface Window {
        __DRAWER_SAMPLES__?: DrawerSample[];
        __DRAWER_TIMER__?: number;
    }
}

// Regression: when the chat log sits at its page limit, a live turn used to
// evict the oldest loaded rows (live-progress trim plus tail-window slide),
// visibly draining old expanded work drawers until the completion refetch
// restored them. Loaded history must only grow while the chat stays open.
test('keeps loaded history and an open old work drawer stable through a live turn', async ({
    page,
}) => {
    test.setTimeout(180_000);

    await page.goto('/dashboard/overview');
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

    // Give the first turn's drawer several steps, then fill the log to the
    // 100-row page limit so the next live turn pushes rows past it.
    await seedActivities({ chatId, count: 10, prefix: 'a', turn: 'first' });
    const fillCount = Math.max(0, 100 - (await fetchLogTotal(chatId)));
    await seedActivities({ chatId, count: fillCount, prefix: 'b', turn: 'last' });

    await page.reload();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T2_OK')).toBeVisible({ timeout: 45_000 });

    const drawer = page.getByRole('button', { name: /Worked for/i }).first();
    await drawer.scrollIntoViewIfNeeded();
    if ((await drawer.getAttribute('aria-expanded')) === 'false') {
        await drawer.click();
    }
    await expect(drawer).toHaveAttribute('aria-expanded', 'true');
    await expandDrawerGroups(page, drawer);
    await page.waitForTimeout(800);

    await page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('button[aria-expanded]')).find((el) =>
            /Worked for/i.test(el.textContent ?? '')
        );

        if (!(target instanceof HTMLElement)) {
            throw new Error('Old work drawer button not found.');
        }

        target.dataset.windowSpecTag = 'original';
        const samples: DrawerSample[] = [];
        window.__DRAWER_SAMPLES__ = samples;

        const sample = () => {
            const current = Array.from(document.querySelectorAll('button[aria-expanded]')).find(
                (el) => /Worked for/i.test(el.textContent ?? '')
            );
            const panel = current?.getAttribute('aria-controls')
                ? document.getElementById(current.getAttribute('aria-controls') ?? '')
                : null;

            const hidden = Array.from(document.querySelectorAll('p')).find((el) =>
                /older (?:entry|entries)/.test(el.textContent ?? '')
            );

            samples.push({
                expanded: current?.getAttribute('aria-expanded') ?? 'missing',
                hidden: hidden?.textContent ?? 'none',
                panelHeight: panel ? Math.round(panel.getBoundingClientRect().height) : 0,
                sameNode:
                    current instanceof HTMLElement && current.dataset.windowSpecTag === 'original',
                steps: panel
                    ? (panel as HTMLElement).innerText
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .join('|')
                    : '',
            });
        };

        sample();
        window.__DRAWER_TIMER__ = window.setInterval(sample, 100);
    });

    const composer = page.getByRole('textbox', { name: /Ask for follow-up changes/ });
    await composer.fill(
        'Run the slow QA command against `QA_KICKOFF_TASK.md`, then reply exactly `QA_WINDOW_T3_OK`.'
    );
    await composer.press('Enter');
    await drawer.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(transcriptParagraph(page, 'QA_WINDOW_T3_OK')).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2000);

    const samples = await page.evaluate(() => {
        window.clearInterval(window.__DRAWER_TIMER__);
        return window.__DRAWER_SAMPLES__ ?? [];
    });

    const transitions = samples.filter(
        (sample, index) =>
            index === 0 || JSON.stringify(sample) !== JSON.stringify(samples[index - 1])
    );

    if (transitions.length > 1) {
        console.log('drawer transitions:', JSON.stringify(transitions, null, 1));
    }

    expect(samples.length).toBeGreaterThan(10);

    const initialHeight = samples[0]?.panelHeight ?? 0;
    expect(initialHeight).toBeGreaterThan(100);

    for (const sample of samples) {
        expect(sample.expanded).toBe('true');
        expect(sample.sameNode).toBe(true);
        expect(sample.panelHeight).toBeGreaterThanOrEqual(initialHeight);
    }

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

    const base = Date.parse(response.created_at) + 250;

    for (let index = 0; index < input.count; index += 1) {
        await client.chat.upsertResponseActivity(input.chatId, response.id, {
            artifact_ids: [],
            completed_at: new Date(base + index * 10 + 5).toISOString(),
            detail: `Seed detail ${input.prefix}${index}`,
            id: `act_seed_${input.prefix}_${index}`,
            kind: 'tool_call',
            metadata: {
                runtime: { toolCallId: `seed_${input.prefix}_${index}`, toolName: 'seed_tool' },
                tool: { arguments: { index }, name: 'seed_tool', result: 'ok' },
            },
            started_at: new Date(base + index * 10).toISOString(),
            status: 'completed',
            title: `Seed tool ${input.prefix}${index}`,
        });
    }
}

async function fetchLogTotal(chatId: string) {
    const port = requiredEnv('TAVERN_SERVER_PORT');
    const input = encodeURIComponent(JSON.stringify({ id: chatId, limit: 1 }));
    const response = await fetch(`http://localhost:${port}/trpc/chat.log.list?input=${input}`);

    if (!response.ok) {
        throw new Error(`chat.log.list failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as { result?: { data?: { total?: number } } };
    const total = payload.result?.data?.total;

    if (typeof total !== 'number') {
        throw new Error(`Unexpected chat.log.list payload: ${JSON.stringify(payload)}`);
    }

    return total;
}

// Expand the collapsed count-summary groups inside the drawer so its panel
// height tracks the underlying rows. Tool inspect triggers also carry
// aria-expanded; they open dialogs, so only headers without popups qualify.
async function expandDrawerGroups(page: Page, drawer: ReturnType<Page['locator']>) {
    const panelId = await drawer.getAttribute('aria-controls');

    if (!panelId) {
        return;
    }

    for (let pass = 0; pass < 6; pass += 1) {
        const headers = page.locator(
            `#${panelId} button[aria-expanded="false"]:not([aria-haspopup])`
        );
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
    const composer = page.getByRole('textbox', { name: /Ask for follow-up changes/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });

    await composer.fill(prompt);
    await composer.press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 45_000 });
}

function transcriptParagraph(page: Page, text: string) {
    return page.locator('main p').filter({ hasText: new RegExp(`^${text}$`) });
}

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/dashboard\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/dashboard/chats/')[1];

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return chatId;
}
