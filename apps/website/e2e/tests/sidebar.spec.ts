import { expect, test } from '../support/test.ts';

test('keeps chat activity visible while a sidebar row is hovered or focused', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'true');
    });

    await page.goto('/overview');

    const row = page.locator('a[href="/chats/cht_tavern_agent_dm"]');
    await expect(row).toBeVisible();

    const activity = row
        .locator('span')
        .filter({ hasText: /^(\d+[mhd]|just now|no activity yet)$/u })
        .last();

    await expect(activity).toBeVisible();
    await expect(activity).toHaveCSS('opacity', '1');

    await row.hover();
    await expect(activity).toHaveCSS('opacity', '1');

    await row.focus();
    await expect(activity).toHaveCSS('opacity', '1');
});

test('collapsed sidebar preview opens from the left edge immediately after collapse', async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'true');
    });

    await page.goto('/overview');
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');

    const trigger = page.locator('[data-slot="sidebar-trigger"]');
    const triggerBox = await trigger.boundingBox();
    const sidebarTopbar = page.locator('[data-slot="app-shell-topbar"]');

    await expect(sidebarTopbar).toHaveClass(/no-drag/u);
    await expect(sidebarTopbar).not.toHaveAttribute('data-window-drag-region', '');
    await expect(sidebarTopbar).toHaveAttribute('data-window-drag-disabled', '');

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
    await expect(page.locator('[data-slot="sidebar-collapsed-restore-trigger"]')).toBeVisible();

    await page.mouse.move(4, 220);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');
});

test('collapsed sidebar preview stays open over the top-left chrome', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'false');
    });

    await page.goto('/overview');
    const wrapper = page.locator('[data-slot="sidebar-wrapper"]');

    await page.mouse.move(4, 220);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');

    const restoreTrigger = page.locator('[data-slot="sidebar-collapsed-restore-trigger"]');
    await expect(restoreTrigger).toBeVisible();
    await expect(restoreTrigger).toHaveCSS('-webkit-app-region', 'no-drag');

    await page.mouse.move(48, 44);
    await page.waitForTimeout(180);

    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');
});

test('collapsed sidebar preview stays open throughout the revealed sidebar rectangle', async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'false');
    });

    await page.goto('/overview');
    const sidebar = page.locator('[data-slot="sidebar"]');
    const wrapper = page.locator('[data-slot="sidebar-wrapper"]');

    await page.mouse.move(4, 220);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');

    const sidebarContainer = page.locator('[data-slot="sidebar-container"]');
    const sidebarBox = await sidebarContainer.boundingBox();
    const trigger = page.locator('[data-slot="sidebar-collapsed-restore-trigger"]');
    const triggerBox = await trigger.boundingBox();

    if (!sidebarBox) {
        throw new Error('Sidebar container was not visible.');
    }

    if (!triggerBox) {
        throw new Error('Sidebar trigger was not visible.');
    }

    const keepOpenPoints = [
        {
            x: sidebarBox.x + sidebarBox.width - 4,
            y: triggerBox.y + triggerBox.height / 2,
        },
        {
            x: sidebarBox.x + sidebarBox.width / 2,
            y: sidebarBox.y + 76,
        },
        {
            x: sidebarBox.x + sidebarBox.width - 4,
            y: sidebarBox.y + sidebarBox.height - 24,
        },
    ];

    for (const point of keepOpenPoints) {
        await page.mouse.move(point.x, point.y, { steps: 8 });
        await page.waitForTimeout(180);
        await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');
    }

    await page.mouse.move(
        triggerBox.x + triggerBox.width / 2,
        triggerBox.y + triggerBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.up();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
});

test('collapsed chat topbar clears traffic lights and restore trigger stays clickable', async ({
    page,
}) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'sidebar');
        window.localStorage.setItem('tavern.sidebar.pinnedOpen.v1', 'false');
        document.documentElement?.classList.add('macos-electron');
    });

    await page.goto('/chats/cht_tavern_agent_dm');

    const chatTopbar = page.locator('[data-slot="chat-room-topbar"]');
    await expect(chatTopbar).toBeVisible();

    const topbarBox = await chatTopbar.boundingBox();
    const chatTopbarLeadingContent = chatTopbar.locator('> div').first();
    const leadingContentBox = await chatTopbarLeadingContent.boundingBox();
    const { topbarHeight, trafficLightInset } = await page.evaluate(() => {
        const styles = getComputedStyle(document.documentElement);
        const readNumber = (name: string) => Number.parseFloat(styles.getPropertyValue(name));

        return {
            topbarHeight: readNumber('--topbar-height'),
            trafficLightInset: readNumber('--traffic-light-inset'),
        };
    });

    if (!topbarBox) {
        throw new Error('Chat topbar was not visible.');
    }

    if (!leadingContentBox) {
        throw new Error('Chat topbar leading content was not visible.');
    }

    expect(topbarBox.height).toBeLessThanOrEqual(topbarHeight + 1);
    expect(leadingContentBox.x).toBeGreaterThanOrEqual(trafficLightInset + 31);
    await expect(chatTopbar).toHaveCSS('-webkit-app-region', 'no-drag');

    const restoreTrigger = page.locator('[data-slot="sidebar-collapsed-restore-trigger"]');
    const restoreBox = await restoreTrigger.boundingBox();

    if (!restoreBox) {
        throw new Error('Collapsed sidebar restore trigger was not visible.');
    }

    const wrapper = page.locator('[data-slot="sidebar-wrapper"]');
    const hoverTarget = page.locator('[data-sidebar-hover-target="true"]');
    const topLeftHitTarget = await page.evaluate(() =>
        Boolean(document.elementFromPoint(4, 24)?.closest('[data-sidebar-hover-target="true"]'))
    );

    await expect(hoverTarget).toHaveCSS('-webkit-app-region', 'no-drag');
    expect(topLeftHitTarget).toBe(true);

    await page.mouse.move(4, 24);
    await expect(wrapper).toHaveAttribute('data-sidebar-preview-open', 'true');

    const sidebarContainer = page.locator('[data-slot="sidebar-container"]');
    const sidebarZIndex = await sidebarContainer.evaluate((element) =>
        Number(getComputedStyle(element).zIndex)
    );
    const chatTopbarZIndex = await chatTopbar.evaluate((element) =>
        Number(getComputedStyle(element).zIndex)
    );

    expect(sidebarZIndex).toBeGreaterThan(chatTopbarZIndex);

    const dragRegion = page.locator('[data-slot="app-shell-drag-region"]');
    const dragRegionBox = await dragRegion.boundingBox();
    const dragFade = page.locator('.app-shell-main-top-drag-fade');
    const dragFadeBox = await dragFade.boundingBox();

    if (!dragRegionBox) {
        throw new Error('App shell drag region was not visible.');
    }

    if (!dragFadeBox) {
        throw new Error('App shell main drag fade was not visible.');
    }

    const triggerPoint = {
        x: restoreBox.x + restoreBox.width / 2,
        y: restoreBox.y + restoreBox.height / 2,
    };
    const hitTargetSlot = await page.evaluate(
        ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot]')?.dataset.slot ??
            null,
        triggerPoint
    );

    expect(hitTargetSlot).toBe('sidebar-collapsed-restore-trigger');
    await expect(restoreTrigger).toHaveCSS('-webkit-app-region', 'no-drag');
    expect(triggerPoint.x).toBeLessThan(dragRegionBox.x);
    expect(triggerPoint.x).toBeLessThan(dragFadeBox.x);

    await page.mouse.move(triggerPoint.x, triggerPoint.y, { steps: 8 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute('data-state', 'expanded');
});
