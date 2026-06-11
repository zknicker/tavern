import { expect, test } from '../support/test.ts';

test('permission select saves optimistically without snapping back', async ({ page }) => {
    await page.goto('/dashboard/settings/agent');

    await expect(page.getByText('What to do when a tool call looks risky.')).toBeVisible();

    // Both approval selects match; DOM order puts Tool approvals first. The
    // filter must not pin the current value or the locator dies on change.
    const approvalSelect = page
        .getByRole('combobox')
        .filter({ hasText: /Ask first|Always allow|Always deny/u })
        .first();
    await expect(approvalSelect).toContainText('Ask first');
    await approvalSelect.click();
    await page.getByRole('option', { name: /Always allow/u }).click();

    // Optimistic: the control reflects the choice immediately and stays enabled.
    await expect(approvalSelect).toContainText('Always allow');
    await expect(approvalSelect).toBeEnabled();

    // The engine-restart promise toast narrates the save.
    await expect(page.getByText('Applying settings')).toBeVisible({ timeout: 15_000 });

    // No snap-back once the save settles and the query refetches.
    await page.waitForTimeout(1500);
    await expect(approvalSelect).toContainText('Always allow');
    await expect(approvalSelect).toBeEnabled();
});
