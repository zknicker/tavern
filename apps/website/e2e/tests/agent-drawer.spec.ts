import type { Page } from '@playwright/test';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test('agent avatar opens the drawer and New session lands a durable notice', async ({ page }) => {
    test.setTimeout(150_000);

    await startChat(page, {
        expectedReply: 'QA_AGENT_DRAWER_OK',
        prompt: 'Agent drawer qa marker. Reply exactly `QA_AGENT_DRAWER_OK`.',
    });

    await page
        .getByRole('button', { name: /Agent details:/ })
        .first()
        .click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByText('Session', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Model', { exact: true })).toBeVisible({ timeout: 30_000 });

    await drawer.getByRole('button', { name: 'New session' }).click();

    // The reset lands as a durable new-session notice row while the timeline
    // keeps its history, and both survive a reload.
    const noticeRow = page.locator('main').getByText('New session', { exact: true });
    await expect(noticeRow).toBeVisible({ timeout: 90_000 });

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('main p').filter({ hasText: /^QA_AGENT_DRAWER_OK$/ })).toBeVisible();

    await page.reload();

    await expect(noticeRow).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main p').filter({ hasText: /^QA_AGENT_DRAWER_OK$/ })).toBeVisible({
        timeout: 30_000,
    });
});

test('leading slash is plain composer text, not a palette', async ({ page }) => {
    await startChat(page, {
        expectedReply: 'QA_AGENT_DRAWER_SLASH_OK',
        prompt: 'Agent drawer slash qa. Reply exactly `QA_AGENT_DRAWER_SLASH_OK`.',
    });

    const composer = page.getByRole('textbox', { name: /Chat message/ });
    await expect(composer).toBeEnabled({ timeout: 30_000 });
    await composer.click();
    await composer.pressSequentially('/status check');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(composer).toHaveText('/status check');
});

async function startChat(
    page: Page,
    { expectedReply, prompt }: { expectedReply: string; prompt: string }
) {
    await page.goto('/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await page.waitForURL((url) => /^\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });
    await expect(
        page.locator('main p').filter({ hasText: new RegExp(`^${expectedReply}$`) })
    ).toBeVisible({ timeout: 45_000 });
}
