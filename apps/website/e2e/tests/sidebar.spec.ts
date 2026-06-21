import { expect, test } from '../support/test.ts';

test('collapsed sidebar preview opens from the left edge immediately after collapse', async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'true');
    });

    await page.goto('/dashboard/overview');
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');

    const trigger = page.locator('[data-slot="sidebar-trigger"]');
    const triggerBox = await trigger.boundingBox();

    if (!triggerBox) {
        throw new Error('Sidebar trigger was not visible.');
    }

    await page.mouse.move(
        triggerBox.x + triggerBox.width / 2,
        triggerBox.y + triggerBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.up();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');

    const wrapper = page.locator('[data-slot="sidebar-wrapper"]');
    await expect(wrapper).not.toHaveAttribute('data-sidebar-preview-open', 'true');

    await page.mouse.move(4, 220);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');
});

test('collapsed sidebar preview stays open over the top-left chrome', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'false');
    });

    await page.goto('/dashboard/overview');
    const wrapper = page.locator('[data-slot="sidebar-wrapper"]');

    await page.mouse.move(4, 220);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');

    const previewTopbar = page.locator('[data-slot="app-shell-topbar"]');
    await expect(previewTopbar).toHaveClass(/no-drag/u);
    await expect(previewTopbar).not.toHaveAttribute('data-window-drag-region', '');

    await page.mouse.move(48, 44);
    await page.waitForTimeout(180);

    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');
});
