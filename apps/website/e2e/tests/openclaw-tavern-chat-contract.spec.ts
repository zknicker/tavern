import type { Page } from '@playwright/test';
import {
    type CapturedOpenClawGatewayEvent,
    readCapturedGatewayChatId,
    readCapturedGatewayReplyText,
    startOpenClawGatewayCapture,
} from '../openclaw/gateway-capture.ts';
import { expect, test } from '../support/test.ts';

test('preserves Tavern chat session routing and renders one final reply', async ({ page }) => {
    test.setTimeout(120_000);

    const capture = await startOpenClawGatewayCapture('tavern-chat-contract');
    const expectedReply = `QA-TAVERN-CONTRACT-${Date.now()}`;

    try {
        await page.goto('/dashboard/overview');

        await page
            .locator('#home-prompt')
            .fill(`Tavern Gateway marker check. Use exact marker: \`${expectedReply}\`.`);
        await page.getByRole('button', { name: 'Start chat' }).click();

        const chatId = await waitForRealChatRoute(page);
        const sessionEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId && Boolean(readSessionKey(event)),
            60_000
        );
        const sessionKey = readSessionKey(sessionEvent);

        expect(sessionKey).toContain(`:tavern:channel:${chatId}`);
        expect(sessionKey).not.toMatch(/^agent:[^:]+:main$/);

        const finalEvent = await capture.waitForEvent(
            (event) =>
                readCapturedGatewayChatId(event) === chatId &&
                isVisibleFinalReplyEvent(event) &&
                readCapturedGatewayReplyText(event)?.trim() === expectedReply,
            90_000
        );

        expect(readCapturedGatewayReplyText(finalEvent)?.trim()).toBe(expectedReply);

        const finalReply = page.locator('main').getByText(expectedReply, { exact: true });
        await expect(finalReply).toBeVisible({ timeout: 45_000 });
        await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
        await expect(finalReply).toHaveCount(1);
        expect(
            capture.events().some((event) => event.event === 'plugin.tavern.message.created')
        ).toBe(false);
    } finally {
        capture.snapshot('tavern-chat-contract');
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

    return decodeURIComponent(chatId);
}

function isVisibleFinalReplyEvent(event: CapturedOpenClawGatewayEvent) {
    if (event.event === 'session.message') {
        return asRecord(asRecord(event.payload).message).role === 'assistant'
            ? Boolean(readCapturedGatewayReplyText(event))
            : false;
    }

    if (event.event !== 'chat') {
        return false;
    }

    const payload = asRecord(event.payload);
    const state = typeof payload.state === 'string' ? payload.state : null;

    if (!(state === 'completed' || state === 'done' || state === 'final')) {
        return false;
    }

    return Boolean(readCapturedGatewayReplyText(event));
}

function readSessionKey(event: CapturedOpenClawGatewayEvent) {
    const payload = asRecord(event.payload);
    const sessionKey = payload.sessionKey ?? payload.key ?? asRecord(payload.session).sessionKey;

    return typeof sessionKey === 'string' && sessionKey.trim() ? sessionKey : null;
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
