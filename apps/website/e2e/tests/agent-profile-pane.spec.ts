import type { Page } from '@playwright/test';
import { sendAgentDmTurn } from '../support/agent-dm.ts';
import { expect, test } from '../support/test.ts';

test('agent avatar opens the profile side pane', async ({ page }) => {
    test.setTimeout(150_000);

    await startChat(page, {
        expectedReply: 'QA_AGENT_PROFILE_OK',
        prompt: 'Agent profile qa marker. Reply exactly `QA_AGENT_PROFILE_OK`.',
    });

    await page
        .getByRole('button', { name: /Agent details:/ })
        .first()
        .click();

    const pane = page.getByRole('complementary', { name: 'Agent profile' });
    await expect(pane).toBeVisible({ timeout: 15_000 });

    // The full six-tab profile renders in the pane (specs/agent-profile.md).
    for (const tab of ['Profile', 'Activity', 'Chat', 'Reminders', 'Workspace', 'Apps']) {
        await expect(pane.getByRole('tab', { name: tab })).toBeVisible();
    }
    await expect(pane.getByRole('combobox', { name: 'Agent model' })).toBeVisible({
        timeout: 30_000,
    });

    await pane.getByRole('button', { name: 'Close' }).click();
    await expect(pane).toHaveCount(0);
    await expect(page.locator('main p').filter({ hasText: /^QA_AGENT_PROFILE_OK$/ })).toBeVisible();
});

test('leading slash is plain composer text, not a palette', async ({ page }) => {
    await startChat(page, {
        expectedReply: 'QA_AGENT_PROFILE_SLASH_OK',
        prompt: 'Agent profile slash qa. Reply exactly `QA_AGENT_PROFILE_SLASH_OK`.',
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
