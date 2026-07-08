import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test.describe.configure({ timeout: 120_000 });

test('preserves Tavern chat session routing and renders one final reply', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-TAVERN-CONTRACT-${Date.now()}`;

    await page.goto('/overview');

    await fillComposer(
        page,
        '#home-prompt',
        `Tavern agent marker check. Use exact marker: \`${expectedReply}\`.`
    );
    await expect(page.getByRole('button', { name: 'Start chat' })).toBeEnabled({
        timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Start chat' }).click();

    const chatId = await waitForRealChatRoute(page);
    await expect(markerCodeOccurrences(page, expectedReply)).toHaveCount(2, { timeout: 45_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
    expect(chatId).not.toBe('new');
});

test('keeps channel messages human-only until an agent is addressed', async ({ page }) => {
    test.setTimeout(90_000);

    const humanOnlyMarker = `QA-HUMAN-ONLY-${Date.now()}`;

    await createChannel(page, `human-only-${Date.now()}`);
    await fillChatComposer(page, `Human only channel smoke ${humanOnlyMarker}`);
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(userPromptParagraph(page, humanOnlyMarker)).toHaveCount(1, {
        timeout: 30_000,
    });
    await page.waitForTimeout(1500);
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('routes a channel mention to the Tavern agent', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-CHANNEL-MENTION-${Date.now()}`;

    await createChannel(page, `mention-route-${Date.now()}`);
    await mentionTavernAgent(page, `Reply exactly \`${expectedReply}\`.`);

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('routes the Tavern agent DM through its current session', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-AGENT-DM-${Date.now()}`;

    await page.goto('/chats/cht_tavern_agent_dm');
    await fillChatComposer(page, `DM smoke. Reply exactly \`${expectedReply}\`.`);
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('stores Tavern generated AGENTS.md without runtime bootstrap companion files', async () => {
    test.setTimeout(120_000);

    const runtimeUrl = requireRuntimeUrl();

    await saveWorkspaceInstructions({
        agentName: 'main',
        runtimeUrl,
        workspaceDir: getManagedWorkspaceDir(),
    });

    const fullText = await getRuntimeInstructions(runtimeUrl);

    expect(fullText).toContain('# Tavern Agent Instructions');
    expect(fullText).toContain('Memory and Wiki are the durable knowledge you can carry forward.');
    expect(fullText).toContain("Wiki is Tavern's shared, browsable Markdown knowledge base");
    expect(fullText).toContain('run `wiki_search` before concluding you lack context');
    expect(fullText).not.toContain('# SOUL.md - Who You Are');
    expect(fullText).not.toContain('# TOOLS.md - Local Notes');
    expect(fullText).not.toContain('# IDENTITY.md - Who Am I?');
    expect(fullText).not.toContain('Missing file: SOUL.md');
    expect(fullText).not.toContain('Missing file: TOOLS.md');
    expect(fullText).not.toContain('Missing file: IDENTITY.md');
});

async function waitForRealChatRoute(page: Page) {
    await page.waitForURL((url) => /^\/chats\/(?!new$)[^/]+$/.test(url.pathname), {
        timeout: 30_000,
    });

    const pathname = new URL(page.url()).pathname;
    const chatId = pathname.split('/chats/')[1] ?? null;

    if (!chatId || chatId === 'new') {
        throw new Error(`Expected a real chat route, received "${pathname}".`);
    }

    return decodeURIComponent(chatId);
}

async function createChannel(page: Page, name: string) {
    await page.goto('/overview');

    await page.getByText('Channels', { exact: true }).hover();
    await page.getByRole('button', { name: 'New channel' }).click();
    await page.getByLabel('Channel name').fill(name);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled({
        timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Create' }).click();

    return await waitForRealChatRoute(page);
}

async function fillChatComposer(page: Page, text: string) {
    const composer = page.getByRole('textbox', { name: 'Chat message' });

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(text);
    await expect(composer).toContainText(text, { timeout: 5000 });
}

async function mentionTavernAgent(page: Page, text: string) {
    const composer = page.getByRole('textbox', { name: 'Chat message' });

    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
    await composer.pressSequentially('@Otto');
    await page
        .getByRole('listbox')
        .getByRole('option', { name: /Otto Agent in this chat/u })
        .click();
    await composer.pressSequentially(` ${text}`);
    await composer.press('Enter');
}

function markerCodeOccurrences(page: Page, marker: string) {
    return page.locator('code').filter({ hasText: exactTextRegex(marker) });
}

function transcriptParagraph(page: Page, text: string | RegExp) {
    return page.locator('p').filter({
        hasText: typeof text === 'string' ? exactTextRegex(text) : text,
    });
}

function userPromptParagraph(page: Page, marker: string) {
    return page.locator('p').filter({ hasText: marker });
}

function exactTextRegex(text: string) {
    return new RegExp(`^${escapeRegExp(text)}$`);
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getManagedWorkspaceDir() {
    const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
    return fileURLToPath(
        new URL(`../../../../.context/e2e/${runId}/tavern-runtime/agent/workspace`, import.meta.url)
    );
}

function requireRuntimeUrl() {
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL;

    if (!runtimeUrl) {
        throw new Error('TAVERN_RUNTIME_URL is required for prompt inspection e2e coverage.');
    }

    return runtimeUrl;
}

async function saveWorkspaceInstructions(input: {
    agentName: string;
    runtimeUrl: string;
    workspaceDir: string;
}) {
    await putRuntimeJson(`${input.runtimeUrl}/workspace/agents/main/instructions`, {
        agentName: input.agentName,
        workspaceDir: input.workspaceDir,
    });
}

function runtimeAuthHeaders(): HeadersInit {
    const token = process.env.TAVERN_RUNTIME_TOKEN?.trim();
    return token ? { authorization: `Bearer ${token}` } : {};
}

async function putRuntimeJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', ...runtimeAuthHeaders() },
        method: 'PUT',
    });

    if (!response.ok) {
        throw new Error(`Runtime request failed (${response.status}): ${await response.text()}`);
    }
}

async function getRuntimeInstructions(runtimeUrl: string) {
    const response = await fetch(`${runtimeUrl}/workspace/agents/main/instructions`, {
        headers: runtimeAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Runtime request failed (${response.status}): ${await response.text()}`);
    }

    const body = asRecord(await response.json());
    const content = body.content;
    if (typeof content !== 'string') {
        throw new Error('Expected Runtime instructions response content.');
    }
    return content;
}
