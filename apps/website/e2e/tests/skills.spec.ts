import { expect, test } from '../support/test.ts';

test('lists installed skills with available and sources management', async ({ page }) => {
    await page.goto('/settings/skills');

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByText('Browse skills')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Installed skills' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Available skills' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tools' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'MCP' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Manage skill sources' }).click();
    await expect(page.getByRole('heading', { name: 'Skill sources' })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('treeitem', { name: 'Built-in library' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'tavern-workflow' })).toBeVisible();
});

test('redirects the retired tools settings page to Plugins', async ({ page }) => {
    await page.goto('/settings/tools');

    await expect(page).toHaveURL(/\/settings\/plugins$/);
    await expect(page.getByRole('heading', { name: 'Plugins' })).toBeVisible();
});

test('splits channels and MCP into separate settings pages', async ({ page }) => {
    await page.goto('/settings/channels');

    await expect(page.getByRole('main').getByText('Channels', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Tavern', { exact: true })).toBeVisible();

    await page.goto('/settings/mcp');

    await expect(page.getByRole('main').getByText('Advanced MCP', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText(/MCP servers/)).toBeVisible();
});
