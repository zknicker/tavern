import type { Page } from '@playwright/test';
import { expect, test } from '../support/test.ts';

test('focuses the homepage composer with adventure placeholder copy', async ({ page }) => {
    await page.goto('/overview');

    const composer = page.locator('#home-prompt');

    await expect(composer).toBeFocused();
    await expect(composer).toHaveText('');
    await expect(page.getByText("Let's go on an adventure...")).toBeVisible();
});

test('autocompletes runtime skills with the dollar trigger', async ({ page }) => {
    const skill = await firstInventorySkill(page);

    await page.goto('/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially(`Please use $${skill.insertText}`);

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox.getByText('Skills', { exact: true })).toBeVisible();
    await listbox
        .getByRole('option', { name: new RegExp(`^${escapeRegExp(skill.label)}`, 'u') })
        .click();

    await expect(composer).toContainText(`Please use ${skill.label} `);
    await expect(composer).not.toContainText(/SKILL\.md/);
    await composer.pressSequentially('after');
    await expect(composer).toContainText(`Please use ${skill.label} after`);
    await expect(listbox).toHaveCount(0);
});

test('dollar trigger filters the picker to skills', async ({ page }) => {
    await page.goto('/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('Use $');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox.getByText('Skills', { exact: true })).toBeVisible();
    await expect(listbox.getByText('Mac apps', { exact: true })).toHaveCount(0);
    await expect(listbox.getByText('Plugins', { exact: true })).toHaveCount(0);

    await page.keyboard.press('Enter');

    await expect(composer).toContainText(/^Use [^\n[\]()]+ $/);
});

test('backspace removes a mention chip without moving the caret to a new line', async ({
    page,
}) => {
    const skill = await firstInventorySkill(page);

    await page.goto('/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially(`Use $${skill.insertText}`);
    await page
        .getByRole('option', { name: new RegExp(`^${escapeRegExp(skill.label)}`, 'u') })
        .click();

    await expect(composer).toHaveText(`Use ${skill.label} `);

    await page.keyboard.press('Backspace');

    await expect(composer).toHaveText('Use ');
    await composer.pressSequentially('again');
    await expect(composer).toHaveText('Use again');
});

test('keeps mention chips editable in common composer flows', async ({ page }) => {
    const skill = await firstInventorySkill(page);

    await page.goto('/overview');

    const composer = page.locator('#home-prompt');

    await composer.click();
    await composer.pressSequentially(`$${skill.insertText}`);
    await page
        .getByRole('option', { name: new RegExp(`^${escapeRegExp(skill.label)}`, 'u') })
        .click();
    await composer.pressSequentially('done');

    await expect(composer).toContainText(new RegExp(`^${escapeRegExp(skill.label)} done$`, 'u'));

    await page.goto('/overview');
    await composer.click();
    await composer.pressSequentially('Use $zz');

    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(composer).toHaveText('Use $zz');
});

test('inserts a newline on Shift+Enter in the mention composer', async ({ page }) => {
    await page.goto('/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('first');
    await page.keyboard.press('Shift+Enter');
    await composer.pressSequentially('second');

    await expect
        .poll(() =>
            composer.evaluate((element) =>
                element instanceof HTMLTextAreaElement ? element.value : element.innerText
            )
        )
        .toBe('first\n\nsecond');
});

test('keeps keyboard selection visible in the skill picker', async ({ page }) => {
    await page.goto('/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('$');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => listbox.getByRole('option').count()).toBeGreaterThan(0);
    await composer.click();

    const scrollContainer = page.getByTestId('mention-list-scroll');
    await expect(scrollContainer).toBeVisible();

    for (let index = 0; index < 3; index += 1) {
        await composer.press('ArrowDown');
    }

    for (let index = 0; index < 3; index += 1) {
        await composer.press('ArrowUp');
    }

    await expect
        .poll(() =>
            scrollContainer.evaluate((element) => {
                const selected = element.querySelector('[aria-selected="true"]');
                const header = element.querySelector('[data-mention-group-label]');

                if (!selected) {
                    return false;
                }

                const containerRect = element.getBoundingClientRect();
                const selectedRect = selected.getBoundingClientRect();
                const headerHeight = header?.getBoundingClientRect().height ?? 0;

                return (
                    selectedRect.top >= containerRect.top + headerHeight &&
                    selectedRect.bottom <= containerRect.bottom
                );
            })
        )
        .toBe(true);
});

test('submits mention markdown plus Tavern metadata without starting a turn', async ({ page }) => {
    // The runtime's skill catalog follows the installed engine, so resolve a
    // real skill from the live inventory instead of pinning a name. Skills
    // serialize as a markdown link only when the id is a path or URI.
    const skill = await firstInventorySkill(page);
    const skillLabel = `$${skill.insertText}`;
    const cases = [
        {
            kind: 'skill',
            optionName: new RegExp(`^${escapeRegExp(skill.label)}`, 'u'),
            query: `$${skill.insertText}`,
            serialized:
                skill.id.includes('://') || skill.id.startsWith('/')
                    ? `[${skillLabel}](${skill.id})`
                    : skillLabel,
        },
    ];

    for (const testCase of cases) {
        await page.goto('/overview');

        const chatStartRequest = waitForBlockedChatStart(page);
        const composer = page.locator('#home-prompt');

        await composer.click();
        await composer.pressSequentially(`Use ${testCase.query}`);
        await page.getByRole('listbox').getByRole('option', { name: testCase.optionName }).click();
        await page.getByRole('button', { name: 'Start chat' }).click();

        const payload = await chatStartRequest;
        const input = readTrpcInput(payload);
        const content = String(input.content);
        const mentions = readMentions(input.metadata);

        if (typeof testCase.serialized === 'string') {
            expect(content).toContain(`Use ${testCase.serialized}`);
            expect(mentions[0]?.text).toBe(testCase.serialized);
        } else {
            expect(content).toMatch(testCase.serialized);
            expect(mentions[0]?.text).toMatch(testCase.serialized);
        }

        expect(mentions).toHaveLength(1);
        expect(mentions[0]?.kind).toBe(testCase.kind);
        expect(mentions[0]?.start).toBe(4);
        expect(mentions[0]?.end).toBe(4 + String(mentions[0]?.text).length);
    }
});

async function firstInventorySkill(page: Page) {
    const serverPort = process.env.TAVERN_SERVER_PORT;
    const response = await page.request.get(
        `http://127.0.0.1:${serverPort}/trpc/mention.inventory`
    );
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as {
        result?: {
            data?: {
                options?: Array<{ id: string; insertText: string; kind: string; label: string }>;
            };
        };
    };
    const skill = (body.result?.data?.options ?? []).find((option) => option.kind === 'skill');

    if (!skill) {
        throw new Error('Expected the mention inventory to expose at least one runtime skill.');
    }

    return skill;
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function waitForBlockedChatStart(page: Page) {
    return new Promise<unknown>((resolve) => {
        const handler: Parameters<Page['route']>[1] = async (route) => {
            const payload = route.request().postDataJSON();

            await route.fulfill({
                body: JSON.stringify({
                    result: {
                        data: {
                            json: {
                                chatId: 'blocked-by-mentions-e2e',
                                messageId: 'blocked-message',
                                sessionId: null,
                            },
                        },
                    },
                }),
                contentType: 'application/json',
                status: 200,
            });
            resolve(payload);
        };

        void page.route('**/trpc/chat.start**', handler, { times: 1 });
    });
}

function readTrpcInput(payload: unknown) {
    if (Array.isArray(payload)) {
        return readTrpcInput(payload[0]);
    }

    if (!payload || typeof payload !== 'object') {
        throw new Error('Expected tRPC payload object.');
    }

    const record = payload as Record<string, unknown>;
    const json = readRecord(record.json) ?? record;
    const input = readRecord(json.input) ?? readRecord(json['0']) ?? json;

    return input as Record<string, unknown>;
}

function readMentions(metadata: unknown) {
    const tavern = readRecord(readRecord(metadata)?.tavern);
    const mentions = tavern?.mentions;

    if (!Array.isArray(mentions)) {
        throw new Error('Expected Tavern mention metadata.');
    }

    return mentions as Record<string, unknown>[];
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
