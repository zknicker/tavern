import { expect, test } from '../support/test.ts';

test('lists installed skills with available and sources management', async ({ page }) => {
    await page.goto('/dashboard/settings/skills');

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByText('Browse skills')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Installed skills' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Available skills' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Channels' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'MCP' })).toBeVisible();

    await page.getByRole('button', { name: 'Manage skill sources' }).click();
    await expect(page.getByRole('heading', { name: 'Skill sources' })).toBeVisible();
    await expect(page.getByPlaceholder('owner/repo')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('treeitem', { name: 'Built-in library' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'tavern-workflow' })).toBeVisible();
});

test('lists tools on their own settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/tools');

    await expect(page.getByPlaceholder('Search tools...')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
});

test('splits channels and MCP into separate settings pages', async ({ page }) => {
    await page.goto('/dashboard/settings/channels');

    await expect(page.getByRole('main').getByText('Channels', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Tavern', { exact: true })).toBeVisible();

    await page.goto('/dashboard/settings/mcp');

    await expect(page.getByRole('main').getByText('MCP', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText(/MCP servers/)).toBeVisible();
});
