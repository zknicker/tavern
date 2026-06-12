import type { Page } from '@playwright/test';
import { expect, test } from '../support/test.ts';

test('autocompletes runtime skills as visible mention chips', async ({ page }) => {
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('Please use @skill');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox.getByText('Skills', { exact: true })).toBeVisible();
    await expect(listbox.getByRole('option').first()).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(composer).toContainText(/^Please use [^\n[\]()]+ $/);
    await expect(composer).not.toContainText(/SKILL\.md/);
    await composer.pressSequentially('after');
    await expect(composer).toContainText(/^Please use [^\n[\]()]+ after$/);
    await expect(listbox).toHaveCount(0);
});

test('dollar trigger filters the picker to skills', async ({ page }) => {
    await page.goto('/dashboard/overview');

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
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('Use @browser');
    await page.getByRole('option', { name: /Browser\s+Inspect local web targets/u }).click();

    await expect(composer).toHaveText('Use Browser ');

    await page.keyboard.press('Backspace');

    await expect(composer).toHaveText('Use ');
    await composer.pressSequentially('again');
    await expect(composer).toHaveText('Use again');
});

test('keeps mention chips editable in common composer flows', async ({ page }) => {
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');

    await composer.click();
    await composer.pressSequentially('@computer');
    await page.getByRole('option', { name: /Computer Use\s+Control local Mac apps/u }).click();
    await composer.pressSequentially('and @browser');
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('option', { name: /Browser\s+Inspect local web targets/u }).click();
    await composer.pressSequentially('done');

    await expect(composer).toContainText(/^Computer Use and Browser done$/);

    await page.goto('/dashboard/overview');
    await composer.click();
    await composer.pressSequentially('Use @gh');

    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(composer).toHaveText('Use @gh');
});

test('inserts a newline on Cmd+Enter in the mention composer', async ({ page }) => {
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('first');
    await page.keyboard.press('Meta+Enter');
    await composer.pressSequentially('second');

    await expect
        .poll(() =>
            composer.evaluate((element) =>
                element instanceof HTMLTextAreaElement ? element.value : element.innerText
            )
        )
        .toBe('first\n\nsecond');
});

test('scrolls the mention popover to keep keyboard selection visible', async ({ page }) => {
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('@');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => listbox.getByRole('option').count()).toBeGreaterThan(25);
    await composer.click();

    const scrollContainer = page.getByTestId('mention-list-scroll');
    await expect(scrollContainer).toBeVisible();
    await expect.poll(() => scrollContainer.evaluate((element) => element.scrollTop)).toBe(0);

    for (let index = 0; index < 25; index += 1) {
        await composer.press('ArrowDown');
    }

    await expect
        .poll(() => scrollContainer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);

    for (let index = 0; index < 25; index += 1) {
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

test('shows mention empty and file-search loading states', async ({ page }) => {
    await page.route('**/trpc/mention.paths**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
    });
    await page.goto('/dashboard/overview');

    const composer = page.locator('#home-prompt');
    await composer.click();
    await composer.pressSequentially('@specs');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox.getByText('Files', { exact: true })).toBeVisible();
    await expect(listbox.getByText('Searching files...', { exact: true })).toBeVisible();

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await composer.pressSequentially('@zzzzzzzzzz');
    await expect(listbox.getByText('No results', { exact: true })).toBeVisible();
});

test('autocompletes apps, files, directories, and skills as visible mention chips', async ({
    page,
}) => {
    const cases = [
        {
            group: 'Mac apps',
            optionName: /Helium\s+Computer Use/u,
            query: '@helium',
            text: /^Helium $/u,
        },
        {
            group: 'Files',
            optionName: /specs\/mentions\.md/u,
            query: '@specs/mentions.md',
            text: /^specs\/mentions\.md $/u,
        },
        {
            group: 'Files',
            optionName: /^apps\/website\/src\/components\/ui\s+apps\/website\/src\/components$/u,
            query: '@components/ui',
            text: /^apps\/website\/src\/components\/ui $/u,
        },
    ];

    for (const testCase of cases) {
        await page.goto('/dashboard/overview');

        const composer = page.locator('#home-prompt');
        await composer.click();
        await composer.pressSequentially(testCase.query);

        const listbox = page.getByRole('listbox');
        await expect(listbox).toBeVisible({ timeout: 15_000 });
        await expect(listbox.getByText(testCase.group, { exact: true })).toBeVisible();
        await listbox.getByRole('option', { name: testCase.optionName }).click();

        await expect(composer).toContainText(testCase.text);
        await expect(listbox).toHaveCount(0);
    }
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
            query: `@${skill.insertText}`,
            serialized:
                skill.id.includes('://') || skill.id.startsWith('/')
                    ? `[${skillLabel}](${skill.id})`
                    : skillLabel,
        },
        {
            kind: 'plugin',
            optionName: /Browser\s+Inspect local web targets/u,
            query: '@browser',
            serialized: '[@Browser](plugin://browser@openai-bundled)',
        },
        {
            kind: 'app',
            optionName: /Helium\s+Computer Use/u,
            query: '@helium',
            serialized: '[@Helium](plugin://computer-use@openai-bundled)',
        },
        {
            kind: 'file',
            optionName: /specs\/mentions\.md/u,
            query: '@specs/mentions.md',
            serialized: /\[specs\/mentions\.md\]\(.+\/specs\/mentions\.md\)/u,
        },
        {
            kind: 'directory',
            optionName: /^apps\/website\/src\/components\/ui\s+apps\/website\/src\/components$/u,
            query: '@components/ui',
            serialized:
                /\[apps\/website\/src\/components\/ui\]\(.+\/apps\/website\/src\/components\/ui\)/u,
        },
    ];

    for (const testCase of cases) {
        await page.goto('/dashboard/overview');

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

        if (testCase.kind === 'app') {
            expect(mentions[0]?.metadata).toMatchObject({ bundleId: 'net.imput.helium' });
        }
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
