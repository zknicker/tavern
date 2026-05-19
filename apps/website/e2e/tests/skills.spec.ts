import { expect, test } from '../support/test.ts';

test('lists runtime-visible skills and plugins catalog rows', async ({ page }) => {
    await page.goto('/dashboard/skills');

    await expect(page.getByPlaceholder('Search skills and plugins...')).toBeVisible();
    await expect(page.getByText(/skills & plugins$/u)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1password', { exact: true })).toBeVisible();
    await expect(page.getByText('Skill').first()).toBeVisible();
    await expect(page.getByText('Not usable').first()).toBeVisible();
});
