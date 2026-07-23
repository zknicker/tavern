import { expect, test } from '../support/test.ts';

test('lists installed skills with available and sources management', async ({ page }) => {
    await page.goto('/settings/skills');

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByText('Browse skills')).toBeVisible();
    // Installed skills render as per-skill folders in the browse tree.
    await expect(page.getByRole('treeitem', { name: 'tavern-agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tools' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'MCP' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Manage skill sources' }).click();
    await expect(page.getByRole('heading', { name: 'Skill sources' })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await page.keyboard.press('Escape');

    // The available catalog lives in the add-from-library dialog.
    await page.getByRole('button', { name: 'Add from library' }).click();
    const libraryDialog = page.getByRole('dialog', { name: 'Add from library' });
    await expect(libraryDialog.getByText('Tavern Workflow', { exact: true })).toBeVisible();
    await expect(libraryDialog.getByText('Built-in', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
});

test('redirects the retired tools settings page to Plugins', async ({ page }) => {
    await page.goto('/settings/tools');

    await expect(page).toHaveURL(/\/settings\/plugins$/);
    await expect(page.getByRole('heading', { exact: true, name: 'Plugins' })).toBeVisible();
});

test('splits channels and MCP into separate settings pages', async ({ page }) => {
    await page.goto('/settings/channels');

    await expect(page.getByRole('heading', { level: 1, name: 'Channels' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Grotto', { exact: true }).first()).toBeVisible();

    await page.goto('/settings/mcp');

    await expect(
        page.getByRole('main').getByText('Advanced MCP', { exact: true }).first()
    ).toBeVisible();
    await expect(
        page
            .getByRole('main')
            .getByText(/MCP servers/)
            .first()
    ).toBeVisible();
});
