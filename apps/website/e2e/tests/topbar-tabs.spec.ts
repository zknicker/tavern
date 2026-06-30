import type { Page } from '@playwright/test';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

// The + button is the only "New tab"-named control with an aria-label; the blank tabs
// themselves are activate buttons carrying just title="New tab".
const newTabButtonSelector = 'button[aria-label="New tab"]';
const blankTabSelector = 'button[title="New tab"]:not([aria-label])';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.app.layout.mode.v2', 'tabs');
    });
});

test('a fresh window opens with exactly one blank tab', async ({ page }) => {
    await page.goto('/overview');

    await expect(page).toHaveURL(/\/new\//u);
    await expect(page.locator(blankTabSelector)).toHaveCount(1);
    await expect(page.locator('#home-prompt')).toBeVisible();
});

test('the + button opens additional blank tabs that coexist', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    const newTabButton = page.locator(newTabButtonSelector);
    await newTabButton.click();
    await newTabButton.click();

    // One from the fresh-window tab plus two from the clicks.
    await expect(page.locator(blankTabSelector)).toHaveCount(3);
});

test('the toolbar section nav navigates between dashboard sections', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    await page.getByRole('button', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/tasks/u);

    await page.getByRole('button', { name: 'Tavern' }).click();
    await expect(page).toHaveURL(/\/overview/u);
});

test('navigating a section turns the active tab into that section (no extra tab)', async ({
    page,
}) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    await page.getByRole('button', { name: 'Workspace' }).click();
    await expect(page).toHaveURL(/\/workspace/u);

    // The single tab became the Workspace page — generic browser-page behavior.
    await expect(page.locator('.chrome-tab--active')).toContainText('Workspace');
    await expect(page.locator(blankTabSelector)).toHaveCount(0);
});

test('opening a chat renders the connected active tab and shell hairline', async ({ page }) => {
    await startChat(
        page,
        'Topbar tab marker. Reply exactly `QA_TOPBAR_TAB_OK`.',
        'QA_TOPBAR_TAB_OK'
    );

    const activeTab = page.locator('.chrome-tab--active');
    await expect(activeTab).toBeVisible();
    // The active tab carries the white connected silhouette (an inline SVG fill)…
    await expect(activeTab.locator('svg').first()).toBeVisible();
    // …and the shell draws the single continuous hairline as a stroked path.
    await expect(page.locator('svg path[stroke]').first()).toBeVisible();
});

test('starting a chat from the blank tab consumes it in place', async ({ page }) => {
    await startChat(page, 'New tab marker. Reply exactly `QA_NEW_TAB_OK`.', 'QA_NEW_TAB_OK');

    // The blank tab became the chat — no blank "new tab" remains.
    await expect(page.locator(blankTabSelector)).toHaveCount(0);
});

test('closing the last tab keeps the window non-empty (opens a fresh blank tab)', async ({
    page,
}) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    const activeTab = page.locator('.chrome-tab--active');
    await activeTab.hover();
    await activeTab.getByRole('button', { name: /^Close/u }).click();

    // Never tab-less: a fresh blank tab replaces the closed one.
    await expect(page).toHaveURL(/\/new\//u);
    await expect(page.locator(blankTabSelector)).toHaveCount(1);
});

test('keyboard: Cmd+T opens a tab and Cmd+W closes it', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    // Give the page keyboard focus before sending window-level shortcuts.
    await page.locator('.chrome-tab--active').click();

    await page.keyboard.press('ControlOrMeta+KeyT');
    await expect(page.locator(blankTabSelector)).toHaveCount(2);

    await page.keyboard.press('ControlOrMeta+KeyW');
    await expect(page.locator(blankTabSelector)).toHaveCount(1);
});

test('keyboard: Cmd+Shift+T reopens the most recently closed tab', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/new\//u);

    await page.keyboard.press('ControlOrMeta+KeyT');
    await page.getByRole('button', { name: 'Workspace' }).click();
    await expect(page).toHaveURL(/\/workspace/u);

    await page.keyboard.press('ControlOrMeta+KeyW');
    await expect(page).toHaveURL(/\/new\//u);

    await page.keyboard.press('ControlOrMeta+Shift+KeyT');
    await expect(page).toHaveURL(/\/workspace/u);
});

test('keyboard: Cmd+1/Cmd+9 jump to a tab by position', async ({ page }) => {
    await page.goto('/overview');
    await page.getByRole('button', { name: 'Workspace' }).click();
    await expect(page).toHaveURL(/\/workspace/u);

    await page.keyboard.press('ControlOrMeta+KeyT');
    await page.getByRole('button', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/tasks/u);

    await page.keyboard.press('ControlOrMeta+Digit1');
    await expect(page).toHaveURL(/\/workspace/u);

    await page.keyboard.press('ControlOrMeta+Digit9');
    await expect(page).toHaveURL(/\/tasks/u);
});

test('middle-clicking a tab closes it', async ({ page }) => {
    await page.goto('/overview');
    await page.locator(newTabButtonSelector).click();
    await expect(page.locator(blankTabSelector)).toHaveCount(2);

    await page.locator(blankTabSelector).first().click({ button: 'middle' });
    await expect(page.locator(blankTabSelector)).toHaveCount(1);
});

async function startChat(page: Page, prompt: string, expectedReply: string) {
    await page.goto('/overview');
    // A fresh window opens a blank tab on the Tavern home; start the chat from it.
    await page.waitForURL(/\/new\//u);
    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();
    await expect(page.locator(`text=${expectedReply}`).first()).toBeVisible({ timeout: 45_000 });
}
