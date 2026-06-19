import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src/api/router.ts';
import { fillComposer } from '../support/composer.ts';
import { expect, test } from '../support/test.ts';

test('preserves Tavern chat session routing and renders one final reply', async ({ page }) => {
    test.setTimeout(120_000);

    const expectedReply = `QA-TAVERN-CONTRACT-${Date.now()}`;

    await page.goto('/dashboard/overview');

    await fillComposer(
        page,
        '#home-prompt',
        `Tavern Hermes marker check. Use exact marker: \`${expectedReply}\`.`
    );
    await page.getByRole('button', { name: 'Start chat' }).click();

    const chatId = await waitForRealChatRoute(page);
    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Agent is thinking')).toHaveCount(0);
    await expect(finalReply).toHaveCount(1);
    expect(chatId).not.toBe('new');
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

test('recovers accepted user message and active turn after hard reload', async ({ page }) => {
    test.setTimeout(150_000);

    const expectedReply = 'RECOVERED-SUBAGENT-OK';
    const promptMarker = `Subagent recovery worker reload qa check ${Date.now()}`;
    const prompt = `${promptMarker}. Reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expectActiveTurnIndicator(page);

    await page.reload();

    await expect(userPromptParagraph(page, promptMarker)).toBeVisible({
        timeout: 30_000,
    });
    await expectActiveTurnIndicator(page);
    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({
        timeout: 90_000,
    });
});

test('renders live tool progress before the final reply', async ({ page }) => {
    test.setTimeout(240_000);

    const expectedReply = `LIVE-TOOL-PROGRESS-${Date.now()}`;
    const expectedProgress = 'I will inspect the workspace before running the command.';
    const prompt = `Live tool progress qa check. Mid-turn progress qa. Run the slow QA command, then reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toHaveCount(0);

    const liveActivity = page.getByRole('button', { name: commandWorkGroupName }).first();
    await expect(liveActivity).toBeVisible({ timeout: 30_000 });
    await expect(transcriptParagraph(page, expectedProgress)).toBeVisible({ timeout: 90_000 });

    const liveToolEvidence = page
        .getByText(/QA_KICKOFF_TASK\.md|exec|run sleep 4|command sleep 4/i)
        .first();
    await expect(liveToolEvidence).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: commandWorkGroupName })).toHaveCount(1);

    await expect(finalReply).toBeVisible({ timeout: 90_000 });

    const completedActivity = page.getByRole('button', { name: commandWorkGroupName }).first();
    await expect(completedActivity).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: commandWorkGroupName })).toHaveCount(1);
    await openActivityIfClosed(completedActivity);
    await expect(page.getByText(/QA_KICKOFF_TASK\.md|exec|run sleep 4/i).first()).toBeVisible({
        timeout: 10_000,
    });
});

test('renders live widget progress before the final reply', async ({ page }) => {
    test.setTimeout(240_000);

    const expectedReply = `LIVE-WIDGET-PROGRESS-${Date.now()}`;
    const widgetTitle = 'E2E live widget revenue';
    const prompt = `Live widget progress qa check. Render the revenue chart, then reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toHaveCount(0);

    const main = page.locator('main');
    await expect(main.getByText(widgetTitle, { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(main.getByText('Revenue', { exact: true }).first()).toBeVisible({
        timeout: 30_000,
    });
    await expect(finalReply).toHaveCount(0);

    await expect(finalReply).toBeVisible({ timeout: 90_000 });
    await expect(finalReply).toHaveCount(1);

    await page.reload();
    await expect(page.locator('main').getByText(widgetTitle, { exact: true })).toBeVisible({
        timeout: 30_000,
    });
    await expect(transcriptParagraph(page, expectedReply)).toHaveCount(1);
});

test('renders provider-streamed assistant updates between Hermes tool groups', async ({ page }) => {
    test.setTimeout(180_000);

    const expectedReply = `MULTI-STAGE-PROGRESS-${Date.now()}`;
    const firstUpdate = 'I will inspect the fixture first.';
    const secondUpdate = 'I found the fixture and will verify it one more time.';
    const prompt = `Multi-stage progress qa. Run two command checks, then reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    await expect(transcriptParagraph(page, firstUpdate)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/QA_KICKOFF_TASK\.md/i).first()).toBeVisible({ timeout: 90_000 });
    await expect(transcriptParagraph(page, secondUpdate)).toBeVisible({ timeout: 90_000 });
    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 90_000 });

    const readFileGroups = page.getByRole('button', { name: readFileWorkGroupName });
    await expect(readFileGroups).toHaveCount(2, { timeout: 10_000 });
    await expectAbove(transcriptParagraph(page, firstUpdate), readFileGroups.nth(0));
    await expectAbove(readFileGroups.nth(0), transcriptParagraph(page, secondUpdate));
    await expectAbove(transcriptParagraph(page, secondUpdate), readFileGroups.nth(1));
    await expectAbove(readFileGroups.nth(1), transcriptParagraph(page, expectedReply));
});

test('answers a mid-turn clarification choice and resumes the turn', async ({ page }) => {
    test.setTimeout(180_000);

    const expectedReply = `CLARIFICATION-CHOICE-${Date.now()}`;
    const prompt = `Clarification choice qa. Ask the clarification, then reply exactly \`${expectedReply}\`.`;

    await refreshRuntimeCapabilities();
    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await expect(page.getByRole('button', { name: 'Start chat' })).toBeEnabled({
        timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(page.getByText('Which part of California?').first()).toBeVisible({
        timeout: 90_000,
    });
    await page.getByRole('button', { name: /San Francisco/ }).click();

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 90_000 });
});

test('skips a mid-turn clarification and resumes the turn', async ({ page }) => {
    test.setTimeout(180_000);

    const expectedReply = `CLARIFICATION-SKIP-${Date.now()}`;
    const prompt = `Clarification skip qa. Ask the clarification, then reply exactly \`${expectedReply}\`.`;

    await refreshRuntimeCapabilities();
    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await expect(page.getByRole('button', { name: 'Start chat' })).toBeEnabled({
        timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(page.getByText('Which part of California?').first()).toBeVisible({
        timeout: 90_000,
    });
    await page.getByRole('button', { name: 'Skip' }).click();

    await expect(transcriptParagraph(page, expectedReply)).toBeVisible({ timeout: 90_000 });
});

test('renders model thinking as separate activity blocks around tool work', async ({ page }) => {
    test.setTimeout(120_000);

    await enableInlineThinking(page);

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', 'QA thinking visibility check max. Use 3 tools.');
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);

    await expect(page.getByText('THINKING-MAX-OK', { exact: true }).first()).toBeVisible({
        timeout: 90_000,
    });

    await openActivityIfClosed(page.getByRole('button', { name: workGroupHeaderName }).first());
    await expect(page.getByRole('button', { name: /^Thinking$/i })).toHaveCount(2, {
        timeout: 10_000,
    });
    await expect(
        page.getByRole('button', { name: /Read (?:a|\d+) files?|Ran (?:a|\d+) commands?/i })
    ).toBeVisible({
        timeout: 10_000,
    });
    await page
        .getByRole('button', { name: /^Thinking$/i })
        .first()
        .click();
    await expect(
        page.getByText(/I should show this reasoning summary in Tavern\./).first()
    ).toBeVisible({ timeout: 10_000 });
});

test('preserves one user message and tool progress across repeated hard reloads', async ({
    page,
}) => {
    test.setTimeout(180_000);

    const expectedReply = 'Evidence snippet: # QA kickoff task';
    const promptMarker = `Live tool progress qa check. Reload-heavy tool turn qa ${Date.now()}`;
    const prompt = `${promptMarker}. Run the slow QA command, then reply exactly \`${expectedReply}\`.`;

    await page.goto('/dashboard/overview');

    await fillComposer(page, '#home-prompt', prompt);
    await page.getByRole('button', { name: 'Start chat' }).click();

    await waitForRealChatRoute(page);
    await expect(page.getByRole('button', { name: commandWorkGroupName }).first()).toBeVisible({
        timeout: 30_000,
    });

    await page.reload();
    await expect(userPromptParagraph(page, promptMarker)).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: commandWorkGroupName }).first()).toBeVisible({
        timeout: 30_000,
    });

    await page.reload();
    await expect(userPromptParagraph(page, promptMarker)).toHaveCount(1, {
        timeout: 30_000,
    });
    const activity = page.getByRole('button', { name: commandWorkGroupName }).first();
    await expect(activity).toBeVisible({ timeout: 60_000 });
    await openActivityIfClosed(activity);
    await expect(page.getByText(/QA_KICKOFF_TASK\.md/i).first()).toBeVisible({
        timeout: 60_000,
    });

    await page.reload();
    await expect(userPromptParagraph(page, promptMarker)).toHaveCount(1, {
        timeout: 30_000,
    });
    const finalReply = transcriptParagraph(page, expectedReply);
    await expect(finalReply).toBeVisible({
        timeout: 90_000,
    });
    await expect(finalReply).toHaveCount(1);
    await expect(page.getByLabel('Agent is thinking')).toBeHidden({ timeout: 30_000 });
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

async function openActivityIfClosed(activity: ReturnType<Page['getByRole']>) {
    if ((await activity.getAttribute('aria-expanded')) === 'false') {
        await activity.click();
    }
}

async function enableInlineThinking(page: Page) {
    await page.addInitScript(() => {
        window.localStorage.setItem('tavern.chat.thinking-display.enabled', '1');
    });
}

async function expectActiveTurnIndicator(page: Page) {
    // The active work header and the thinking indicator can render together;
    // either one proves the turn is live.
    await expect(
        page
            .getByRole('button', { name: workGroupHeaderName })
            .or(page.getByLabel('Agent is thinking'))
            .first()
    ).toBeVisible({ timeout: 30_000 });
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

const commandWorkGroupName = /^(?:Running|Ran) a command\b/i;
const readFileWorkGroupName = /^Read(?:ing)? a file\b/i;
const workGroupHeaderName =
    /^(?:Using|Used|Reading|Read|Running|Ran|Editing|Edited|Searching|Searched|Rendering|Rendered|Thinking|Worked)\b(?! for)/i;

// Document order, not pixel geometry: the transcript is a single column, and
// bounding boxes race the work panel's height animation while it expands.
async function expectAbove(upper: Locator, lower: Locator) {
    const lowerHandle = await lower.first().elementHandle();
    expect(lowerHandle).not.toBeNull();

    if (!lowerHandle) {
        return;
    }

    const isAbove = await upper
        .first()
        .evaluate(
            (upperElement, lowerElement) =>
                lowerElement instanceof Node &&
                Boolean(
                    upperElement.compareDocumentPosition(lowerElement) &
                        Node.DOCUMENT_POSITION_FOLLOWING
                ),
            lowerHandle
        );
    expect(isAbove).toBe(true);
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
        new URL(
            `../../../../.context/e2e/${runId}/tavern-runtime/hermes/workspace`,
            import.meta.url
        )
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

async function refreshRuntimeCapabilities() {
    const client = createTRPCProxyClient<AppRouter>({
        links: [
            httpLink({
                methodOverride: 'POST',
                url: new URL('/trpc', requireServerOrigin()).toString(),
            }),
        ],
    });
    const requiredCapabilities = ['apiServer', 'gateway', 'models'];
    let missing = requiredCapabilities;

    for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await client.agentRuntime.checkHealth.mutate();
        const healthyCapabilities = new Set(
            status.capabilities
                .filter((capability) => capability.state === 'healthy')
                .map((capability) => capability.capability)
        );

        missing = requiredCapabilities.filter((capability) => !healthyCapabilities.has(capability));

        if (missing.length === 0) {
            return;
        }

        await wait(2000);
    }

    if (missing.length > 0) {
        throw new Error(`Runtime capabilities are not healthy: ${missing.join(', ')}`);
    }
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireServerOrigin() {
    const configured = process.env.VITE_SERVER_ORIGIN?.trim();

    if (configured) {
        return configured;
    }

    return `http://127.0.0.1:${process.env.TAVERN_SERVER_PORT ?? '8081'}`;
}
