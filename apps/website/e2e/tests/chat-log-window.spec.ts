import type { Page } from '@playwright/test';
import { sendAgentDmTurn, tavernAgentDmChatId } from '../support/agent-dm.ts';
import { expect, test } from '../support/test.ts';

// Regression: a live turn used to evict loaded history rows (live-progress
// trim plus tail-window slide), draining old turns' messages until the
// completion refetch restored them. Loaded history must only grow while the
// chat stays open — every earlier turn's reply must survive a later turn.
test('keeps loaded chat history stable through a later live turn', async ({ page }) => {
    test.setTimeout(120_000);

    const chatId = await sendAgentDmTurn(page, {
        expectedReply: 'QA_WINDOW_T1_OK',
        prompt: 'Chat history stability qa check. Reply exactly `QA_WINDOW_T1_OK`.',
    });
    expect(chatId).toBe(tavernAgentDmChatId);

    await sendFollowUp(page, {
        expectedReply: 'QA_WINDOW_T2_OK',
        prompt: 'Follow-up chat turn marker. Reply exactly `QA_WINDOW_T2_OK`.',
    });

    await page.reload();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T2_OK')).toBeVisible({ timeout: 45_000 });

    // Both turns' replies stay loaded after reload.
    await expect(transcriptParagraph(page, 'QA_WINDOW_T1_OK')).toBeVisible();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T2_OK')).toBeVisible();

    await sendFollowUp(page, {
        expectedReply: 'QA_WINDOW_T3_OK',
        prompt: 'Second follow-up chat turn marker. Reply exactly `QA_WINDOW_T3_OK`.',
    });

    // The live turn must not have evicted the earlier turns' replies.
    await expect(transcriptParagraph(page, 'QA_WINDOW_T1_OK')).toBeVisible();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T2_OK')).toBeVisible();
    await expect(transcriptParagraph(page, 'QA_WINDOW_T3_OK')).toBeVisible();
});

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
