import { expect, test } from '../support/test.ts';

test('lists product-visible skills and toolsets catalog rows', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await expect(page.getByPlaceholder('Search skills...')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Toolsets/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Browse/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Plugins/u })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Enabled/u })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Needs setup/u })).toHaveCount(0);

    await page.getByRole('tab', { name: /Toolsets/u }).click();
    await expect(page.getByRole('tab', { name: /Toolsets/u, selected: true })).toBeVisible();
    await expect(page.getByPlaceholder('Search toolsets...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add toolset' })).toBeVisible();
});

test('browses the skill catalog with popular skills and sources', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await page.getByRole('tab', { name: /Browse/u }).click();
    await expect(page.getByRole('tab', { name: /Browse/u, selected: true })).toBeVisible();
    await expect(page.getByLabel('Search the skill catalog')).toBeVisible();

    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(page.getByText('Your GitHub repos')).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
});
