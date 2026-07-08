import { expect, test } from '../support/test.ts';

test('models settings surfaces Runtime model entries instead of OAuth provider placeholders', async ({
    page,
}) => {
    await page.goto('/settings/models');

    const availableModels = page.locator('section').filter({ hasText: 'Available Models' });
    await expect(availableModels.getByText('GPT-5.5', { exact: true }).first()).toBeVisible();
    await expect(availableModels.getByText('openai/gpt-5.5', { exact: true })).toBeVisible();
    await expect(availableModels.getByText('GPT-4.1', { exact: true })).toBeVisible();
    await expect(availableModels.getByText('openai/gpt-4.1', { exact: true })).toBeVisible();
    // The e2e runtime has no Claude/Codex CLIs, so those catalogs are
    // unavailable and stay out of Available Models entirely.
    await expect(availableModels.getByText('claude/claude-opus-4-8', { exact: true })).toHaveCount(
        0
    );
    await expect(availableModels.getByText('codex/gpt-5.5', { exact: true })).toHaveCount(0);
    // Runtime model entries, never OAuth provider placeholders.
    await expect(availableModels.getByText('claude/opus', { exact: true })).toHaveCount(0);
    await expect(availableModels.getByText('claude/fable', { exact: true })).toHaveCount(0);
    await expect(availableModels.getByText('Codex OAuth', { exact: true })).toHaveCount(0);
    await expect(availableModels.getByText('Claude Code OAuth', { exact: true })).toHaveCount(0);
});
