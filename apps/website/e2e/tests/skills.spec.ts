import { expect, test } from '../support/test.ts';

test('lists product-visible skills and toolsets catalog rows', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await expect(page.getByPlaceholder('Search skills...')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Skills/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Toolsets/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sources/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Plugins/u })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Browse/u })).toHaveCount(0);

    await page.getByRole('tab', { name: /Toolsets/u }).click();
    await expect(page.getByRole('tab', { name: /Toolsets/u, selected: true })).toBeVisible();
    await expect(page.getByPlaceholder('Search toolsets...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add toolset' })).toBeVisible();
});

test('lists skill sources with the built-in library and repo management', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await page.getByRole('tab', { name: /Sources/u }).click();
    await expect(page.getByRole('tab', { name: /Sources/u, selected: true })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add repo' })).toBeVisible();
    await expect(page.getByText('Built-in library')).toBeVisible();
});
