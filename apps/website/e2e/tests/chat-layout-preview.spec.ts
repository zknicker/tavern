import type { Page } from '@playwright/test';
import { expect, test } from '../support/test.ts';

const drawerTriggerText = 'Read 2 files, edited a file, ran a command';
const drawerMotionTolerancePx = 1;

interface DrawerMotionResult {
    maxScrollDelta: number;
    maxTopDelta: number;
    minScrollDelta: number;
    minTopDelta: number;
    sampleCount: number;
}

test('keeps the virtualized tool drawer trigger pinned while the drawer animates', async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/dashboard/chat-layout-preview');

    const preview = page.getByTestId('virtualized-tool-drawer-preview');
    const scrollport = page.getByTestId('virtualized-tool-drawer-scrollport');
    const drawerTrigger = preview.getByRole('button', { name: drawerTriggerText });

    await expect(preview).toBeVisible();
    await expect(drawerTrigger).toBeVisible();
    await expect(drawerTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect
        .poll(async () => await scrollport.evaluate((node) => node.scrollTop))
        .toBeGreaterThan(0);

    const expansion = measureDrawerToggle(page);
    await drawerTrigger.click();
    expectPinnedDrawerMotion(await expansion);
    await expect(drawerTrigger).toHaveAttribute('aria-expanded', 'true');

    const collapse = measureDrawerToggle(page);
    await drawerTrigger.click();
    expectPinnedDrawerMotion(await collapse);
    await expect(drawerTrigger).toHaveAttribute('aria-expanded', 'false');
});

function measureDrawerToggle(page: Page) {
    return page.evaluate(
        ({ durationMs, intervalMs, triggerText }) =>
            new Promise<DrawerMotionResult>((resolve, reject) => {
                const preview = document.querySelector(
                    '[data-testid="virtualized-tool-drawer-preview"]'
                );
                const viewport = preview?.querySelector(
                    '[data-testid="virtualized-tool-drawer-scrollport"]'
                );
                const trigger = Array.from(
                    preview?.querySelectorAll('button[aria-expanded]') ?? []
                ).find((button) => button.textContent?.trim() === triggerText);

                if (!(viewport instanceof HTMLElement && trigger instanceof HTMLElement)) {
                    reject(new Error('Virtualized tool drawer target was not found.'));
                    return;
                }

                const baselineTop = trigger.getBoundingClientRect().top;
                const baselineScrollTop = viewport.scrollTop;
                const topDeltas: number[] = [];
                const scrollDeltas: number[] = [];
                const startedAt = Date.now();

                const sample = () => {
                    topDeltas.push(trigger.getBoundingClientRect().top - baselineTop);
                    scrollDeltas.push(viewport.scrollTop - baselineScrollTop);

                    if (Date.now() - startedAt >= durationMs) {
                        resolve({
                            maxScrollDelta: Math.max(...scrollDeltas),
                            maxTopDelta: Math.max(...topDeltas),
                            minScrollDelta: Math.min(...scrollDeltas),
                            minTopDelta: Math.min(...topDeltas),
                            sampleCount: topDeltas.length,
                        });
                        return;
                    }

                    window.setTimeout(sample, intervalMs);
                };

                sample();
            }),
        {
            durationMs: 650,
            intervalMs: 8,
            triggerText: drawerTriggerText,
        }
    );
}

function expectPinnedDrawerMotion(result: DrawerMotionResult) {
    expect(result.sampleCount).toBeGreaterThan(20);
    expect(Math.abs(result.minTopDelta)).toBeLessThanOrEqual(drawerMotionTolerancePx);
    expect(Math.abs(result.maxTopDelta)).toBeLessThanOrEqual(drawerMotionTolerancePx);
    expect(Math.abs(result.minScrollDelta)).toBeLessThanOrEqual(drawerMotionTolerancePx);
    expect(Math.abs(result.maxScrollDelta)).toBeLessThanOrEqual(drawerMotionTolerancePx);
}
