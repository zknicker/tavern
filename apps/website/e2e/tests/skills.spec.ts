import { expect, test } from '../support/test.ts';

test('lists installed skills with available and sources management', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await expect(page.getByRole('tab', { name: /Installed/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Available/u })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Toolsets/u })).toHaveCount(0);
    await expect(page.getByPlaceholder('Search skills...')).toBeVisible();

    await page.getByRole('button', { name: 'Manage sources' }).click();
    await expect(page.getByRole('heading', { name: 'Skill sources' })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: /Available/u }).click();
    await expect(page.getByRole('tab', { name: /Available/u, selected: true })).toBeVisible();
    await expect(page.getByText('Built-in library')).toBeVisible();

    const addSkill = page.getByRole('button', { name: 'Add skill' }).first();
    await expect(addSkill).toBeVisible();
    await addSkill.click();
    await expect(page.getByRole('button', { name: 'Install skill' })).toBeVisible();
    await expect(page.getByText('Skill', { exact: true })).toBeVisible();
});

test('lists toolsets on their own settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/toolsets');

    await expect(page.getByPlaceholder('Search toolsets...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add toolset' })).toBeVisible();
});
