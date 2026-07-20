import type { Page } from '@playwright/test';
import { sendAgentDmTurn } from '../support/agent-dm.ts';
import { expect, test } from '../support/test.ts';

test('agent avatar opens a read-only session drawer', async ({ page }) => {
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

    // Session status is read-only here; resets live in agent settings
    // (specs/sessions.md).
    await expect(drawer.getByRole('button', { name: 'New session' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.locator('main p').filter({ hasText: /^QA_AGENT_DRAWER_OK$/ })).toBeVisible();
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

// Chats are persistent DMs and channels — turns run in the seeded agent DM.
async function startChat(
    page: Page,
    { expectedReply, prompt }: { expectedReply: string; prompt: string }
) {
    await sendAgentDmTurn(page, { expectedReply, prompt });
}
