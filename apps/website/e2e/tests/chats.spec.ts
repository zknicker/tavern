import type { Page } from '@playwright/test';
import { sendAgentDmTurn } from '../support/agent-dm.ts';
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
