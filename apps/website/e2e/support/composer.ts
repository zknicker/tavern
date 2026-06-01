import type { Page } from '@playwright/test';

export async function fillComposer(page: Page, selector: string, text: string) {
    const composer = page.locator(selector);

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(text);
}
