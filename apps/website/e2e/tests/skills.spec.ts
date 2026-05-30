import { expect, test } from '../support/test.ts';

test('lists product-visible skills and plugins catalog rows', async ({ page }) => {
    await page.goto('/dashboard/skills');

    await expect(page.getByPlaceholder('Search skills and plugins...')).toBeVisible();
    await expect(page.getByRole('tab', { name: /All/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Plugins/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Ready/u })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Needs setup/u })).toHaveCount(0);

    await page.getByRole('tab', { name: /Plugins/u }).click();
    await expect(page.getByRole('tab', { name: /Plugins/u, selected: true })).toBeVisible();
    await expect(page.getByText('Tavern Cortex', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tavern Workspace', { exact: true })).toHaveCount(0);
});
