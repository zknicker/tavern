import type { Page } from '@playwright/test';

export async function fillComposer(page: Page, selector: string, text: string) {
    const composer = page.locator(selector);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await composer.click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.insertText(text);

        await page.waitForFunction(
            ({ expected, targetSelector }) => {
                const element = document.querySelector(targetSelector);

                if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                    return element.value === expected;
                }

                return (element?.textContent ?? '') === expected;
            },
            { expected: text, targetSelector: selector },
            { timeout: 5000 }
        );
        await page.waitForTimeout(100);

        const retainedText = await composer.evaluate((element) => {
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                return element.value;
            }
            return element.textContent ?? '';
        });

        if (retainedText === text) {
            return;
        }
    }

    throw new Error(`Composer did not retain expected text for ${selector}.`);
}
