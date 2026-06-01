import type { Page } from '@playwright/test';
import {
    type CapturedOpenClawGatewayEvent,
    readCapturedGatewayChatId,
    startOpenClawGatewayCapture,
} from '../openclaw/gateway-capture.ts';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test('renders a successful live OpenClaw agent turn', async ({ page }) => {
    test.setTimeout(120_000);

    const capture = await startOpenClawGatewayCapture('live-chat-contract');

    try {
        await page.goto('/dashboard/overview');

        const prompt = `Live OpenClaw contract check ${Date.now()}. Reply briefly with the words "Contract check".`;
        await fillComposer(page, '#home-prompt', prompt);
        await page.getByRole('button', { name: 'Start chat' }).click();

        const chatId = normalizeGatewayChatId(await waitForRealChatRoute(page));
        await capture.waitForEvent(
            (event) => readCapturedGatewayChatId(event) === chatId && isDoneSessionEvent(event),
            90_000
        );

        await expect(page.getByRole('alert').filter({ hasText: 'Agent turn failed' })).toHaveCount(
            0
        );
        await expect(page.locator('main p').filter({ hasText: /Contract check/i })).toBeVisible({
            timeout: 45_000,
        });
        await expect(page.locator('main').getByText(/codex/i)).toBeVisible();
    } finally {
        capture.snapshot('final');
        capture.close();
    }
});

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/dashboard\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/dashboard/chats/')[1] ?? null;

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return chatId;
}

function normalizeGatewayChatId(chatId: string) {
    const decoded = decodeURIComponent(chatId);

    return decoded.split(':').at(-1) ?? decoded;
}

function isDoneSessionEvent(event: CapturedOpenClawGatewayEvent) {
    if (event.event !== 'sessions.changed') {
        return false;
    }

    const payload = asRecord(event.payload);
    const status = typeof payload.status === 'string' ? payload.status : null;
    const sessionStatus =
        typeof asRecord(payload.session).status === 'string'
            ? asRecord(payload.session).status
            : null;

    return payload.phase === 'end' && (status === 'done' || sessionStatus === 'done');
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
