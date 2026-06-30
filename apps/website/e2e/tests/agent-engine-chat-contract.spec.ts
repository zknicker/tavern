import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test.describe.configure({ timeout: 120_000 });

test('preserves Tavern chat session routing and renders one final reply', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-TAVERN-CONTRACT-${Date.now()}`;

    await page.goto('/dashboard/overview');

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
    const markerParagraphs = transcriptParagraph(page, new RegExp(escapeRegExp(expectedReply)));
    await expect(markerParagraphs).toHaveCount(2, { timeout: 45_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
    expect(chatId).not.toBe('new');
});

test('keeps channel messages human-only until an agent is addressed', async ({ page }) => {
    test.setTimeout(90_000);

    const humanOnlyMarker = `QA-HUMAN-ONLY-${Date.now()}`;

    await page.goto('/dashboard/chats/cht_general');
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

    await page.goto('/dashboard/chats/cht_general');
    await mentionTavernAgent(page, `Reply exactly \`${expectedReply}\`.`);

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('routes the Tavern agent DM through its current session', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-AGENT-DM-${Date.now()}`;

    await page.goto('/dashboard/chats/cht_tavern_agent_dm');
    await fillChatComposer(page, `DM smoke. Reply exactly \`${expectedReply}\`.`);
    await page.getByRole('textbox', { name: 'Chat message' }).press('Enter');

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
});

test('starts a new Tavern agent session from the DM UI', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/dashboard/chats/cht_tavern_agent_dm');

    const newSessionButton = page.getByRole('button', { name: 'New session' });
    await expect(newSessionButton).toBeVisible({ timeout: 30_000 });
    await newSessionButton.click();

    await expect(page.locator('main').getByText('Started new session')).toBeVisible({
        timeout: 60_000,
    });
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
    expect(fullText).toContain("Vault is the user's central knowledge hub");
    expect(fullText).toContain('Use the installed `vault` skill');
    expect(fullText).toContain('The Vault path is `TAVERN_VAULT_PATH`');
    expect(fullText).not.toContain('# SOUL.md - Who You Are');
    expect(fullText).not.toContain('# TOOLS.md - Local Notes');
    expect(fullText).not.toContain('# IDENTITY.md - Who Am I?');
    expect(fullText).not.toContain('Missing file: SOUL.md');
    expect(fullText).not.toContain('Missing file: TOOLS.md');
    expect(fullText).not.toContain('Missing file: IDENTITY.md');
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
    await composer.pressSequentially('@Tavern');
    await page
        .getByRole('listbox')
        .getByRole('option', { name: /Tavern Agent in this chat/u })
        .click();
    await composer.pressSequentially(` ${text}`);
    await composer.press('Enter');
}

function transcriptParagraph(page: Page, text: string | RegExp) {
    return page.locator('main p').filter({
        hasText: typeof text === 'string' ? exactTextRegex(text) : text,
    });
}

function userPromptParagraph(page: Page, marker: string) {
    return page.locator('main p').filter({ hasText: marker });
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
