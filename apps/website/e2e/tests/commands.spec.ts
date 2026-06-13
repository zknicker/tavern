import type { Page } from '@playwright/test';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test('slash opens the command palette in a chat and runs the picked command', async ({ page }) => {
    test.setTimeout(120_000);

    await startChat(page, {
        expectedReply: 'QA_COMMANDS_OK',
        prompt: 'Command palette qa marker. Reply exactly `QA_COMMANDS_OK`.',
    });

    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await composer.click();
    await composer.pressSequentially('/');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await expect(listbox.getByText('Commands', { exact: true })).toBeVisible();

    await composer.pressSequentially('status');
    await listbox
        .getByRole('option', { name: /\/status/u })
        .first()
        .click();

    await expect(composer).toHaveText('/status ');

    const workDisclosures = page.getByRole('button', { name: /Work(?:ing|ed) for/i });
    const workDisclosureCount = await workDisclosures.count();

    await composer.press('Enter');

    // The run lands as a durable command card in the timeline — no user
    // message, no success toast, no phantom work turn — and survives a
    // reload.
    const commandCard = page.locator('main').getByText('/status', { exact: true });
    await expect(commandCard).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('main p').filter({ hasText: /^\/status\s*$/u })).toHaveCount(0);
    await expect(workDisclosures).toHaveCount(workDisclosureCount);

    await page.reload();

    await expect(commandCard).toBeVisible({ timeout: 30_000 });
});

test('dismissing a command card hides it durably', async ({ page }) => {
    test.setTimeout(150_000);

    await startChat(page, {
        expectedReply: 'QA_COMMANDS_DISMISS_OK',
        prompt: 'Command dismiss qa marker. Reply exactly `QA_COMMANDS_DISMISS_OK`.',
    });

    await runCommand(page, 'status');

    const commandCard = page.locator('main').getByText('/status', { exact: true });
    await expect(commandCard).toBeVisible({ timeout: 90_000 });

    await commandCard.hover();
    await page.getByRole('button', { name: 'Dismiss command output' }).click();
    await expect(commandCard).toHaveCount(0);

    await page.reload();

    await expect(
        page.locator('main p').filter({ hasText: /^QA_COMMANDS_DISMISS_OK$/ })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main').getByText('/status', { exact: true })).toHaveCount(0);
});

test('/clear empties the timeline and survives a reload', async ({ page }) => {
    test.setTimeout(150_000);

    await startChat(page, {
        expectedReply: 'QA_COMMANDS_CLEAR_OK',
        prompt: 'Command clear qa marker. Reply exactly `QA_COMMANDS_CLEAR_OK`.',
    });

    await runCommand(page, 'clear');

    // Everything before the clear disappears; the clear card itself is the
    // only evidence left and it survives a reload.
    const clearCard = page.locator('main').getByText('/clear', { exact: true });
    await expect(clearCard).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('main p').filter({ hasText: /^QA_COMMANDS_CLEAR_OK$/ })).toHaveCount(
        0
    );

    await page.reload();

    await expect(clearCard).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main p').filter({ hasText: /^QA_COMMANDS_CLEAR_OK$/ })).toHaveCount(
        0
    );
});

test('/new starts fresh context without clearing the timeline', async ({ page }) => {
    test.setTimeout(150_000);

    await startChat(page, {
        expectedReply: 'QA_COMMANDS_NEW_OK',
        prompt: 'Command new qa marker. Reply exactly `QA_COMMANDS_NEW_OK`.',
    });

    await runCommand(page, 'new');

    const newCard = page.locator('main').getByText('/new', { exact: true });
    await expect(newCard).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('main p').filter({ hasText: /^QA_COMMANDS_NEW_OK$/ })).toBeVisible();
});

test('slash typed mid-message never opens the palette', async ({ page }) => {
    await startChat(page, {
        expectedReply: 'QA_COMMANDS_MIDSLASH_OK',
        prompt: 'Command palette mid-slash qa. Reply exactly `QA_COMMANDS_MIDSLASH_OK`.',
    });

    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await composer.click();
    await composer.pressSequentially('see /status');

    await expect(page.getByRole('listbox')).toHaveCount(0);
});

async function runCommand(page: Page, name: string) {
    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await composer.click();
    await composer.pressSequentially('/');

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 15_000 });
    await composer.pressSequentially(name);
    await listbox
        .getByRole('option', { name: new RegExp(`/${name}`, 'u') })
        .first()
        .click();
    await expect(composer).toHaveText(`/${name} `);
    await composer.press('Enter');
}

async function startChat(
    page: Page,
    { expectedReply, prompt }: { expectedReply: string; prompt: string }
) {
    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await page.waitForURL((url) => /^\/dashboard\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });
    await expect(
        page.locator('main p').filter({ hasText: new RegExp(`^${expectedReply}$`) })
    ).toBeVisible({ timeout: 45_000 });
}
