import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { hermesPinnedCommit } from '../../../runtime/src/hermes/engine.ts';
import { expect, test } from '../support/test.ts';

test('permission select saves optimistically without snapping back', async ({ page }) => {
    await page.goto('/dashboard/settings/agent');

    await expect(page.getByText('What to do when a tool call looks risky.')).toBeVisible();

    // Both approval selects match; DOM order puts Tool approvals first. The
    // filter must not pin the current value or the locator dies on change.
    const approvalSelect = page
        .getByRole('combobox')
        .filter({ hasText: /Ask first|Always allow|Always deny/u })
        .first();
    await expect(approvalSelect).toContainText('Ask first');
    await approvalSelect.click();
    await page.getByRole('option', { name: /Always allow/u }).click();

    // Optimistic: the control reflects the choice immediately and stays enabled.
    await expect(approvalSelect).toContainText('Always allow');
    await expect(approvalSelect).toBeEnabled();

    // The engine-restart promise toast narrates the save.
    await expect(page.getByText('Applying settings')).toBeVisible({ timeout: 15_000 });

    // No snap-back once the save settles and the query refetches.
    await page.waitForTimeout(1500);
    await expect(approvalSelect).toContainText('Always allow');
    await expect(approvalSelect).toBeEnabled();

    // Wait out the coordinated engine restart (toast resolves on completion)
    // so later specs in the shared e2e stack start against a settled engine.
    await expect(page.getByText('Settings applied')).toBeVisible({ timeout: 90_000 });
});

test('web page summarizer setting routes web_extract summarization to the selected model', async ({
    page,
}) => {
    test.setTimeout(120_000);

    const auxiliaryModel = 'google/gemini-3-flash-preview';

    await page.goto('/dashboard/settings/agent');
    await expect(page.getByText('Model used to summarize long web pages.')).toBeVisible();

    const summarizerSelect = webExtractSummarizerSelect(page);
    await expect(summarizerSelect).toContainText('Auto');
    await summarizerSelect.click();
    await page.getByRole('option', { name: /Gemini 3 Flash Preview/u }).click();

    await expect(summarizerSelect).toContainText('Gemini 3 Flash Preview');
    await expect(page.getByText('Applying settings')).toBeVisible({ timeout: 15_000 });
    await expect
        .poll(readGeneratedHermesConfig, { timeout: 30_000 })
        .toContain(`model: ${auxiliaryModel}`);
    await expect.poll(readGeneratedHermesConfig, { timeout: 30_000 }).toContain('web_extract:');
    await expect(page.getByText('Settings applied')).toBeVisible({ timeout: 90_000 });

    const smoke = await runWebExtractSummarizerSmoke();

    expect(smoke.model).toBe(auxiliaryModel);
    expect(smoke.task).toBe('web_extract');
});

function webExtractSummarizerSelect(page: Page) {
    return page
        .getByText('Web page summarizer', { exact: true })
        .locator('xpath=ancestor::div[contains(@class, "grid")][1]')
        .getByRole('combobox');
}

async function readGeneratedHermesConfig() {
    return await fs.readFile(path.join(e2eHermesHome(), 'config.yaml'), 'utf8');
}

async function runWebExtractSummarizerSmoke() {
    const engineDir = path.join(
        os.homedir(),
        '.tavern',
        'engine',
        hermesPinnedCommit,
        'hermes-agent'
    );
    const python = path.join(engineDir, 'venv', 'bin', 'python');
    const script = [
        'import asyncio',
        'import json',
        'from tools import web_tools',
        '',
        'class _Message:',
        '    content = "E2E_WEB_EXTRACT_SUMMARY_OK"',
        '    reasoning = None',
        '    reasoning_content = None',
        '    reasoning_details = None',
        '',
        'class _Choice:',
        '    message = _Message()',
        '',
        'class _Response:',
        '    choices = [_Choice()]',
        '',
        'async def fake_async_call_llm(**kwargs):',
        '    print("WEB_EXTRACT_LLM_CALL " + json.dumps({',
        '        "task": kwargs.get("task"),',
        '        "model": kwargs.get("model"),',
        '        "message_count": len(kwargs.get("messages") or []),',
        '        "temperature": kwargs.get("temperature"),',
        '    }, sort_keys=True))',
        '    return _Response()',
        '',
        'web_tools.async_call_llm = fake_async_call_llm',
        '',
        'async def main():',
        '    content = ("Long technical docs section. " * 260)',
        '    result = await web_tools.process_content_with_llm(',
        '        content,',
        '        url="https://example.test/long-doc",',
        '        title="E2E Web Extract",',
        '    )',
        '    if not result:',
        '        raise SystemExit("web_extract summarizer returned no content")',
        '    print(result)',
        '',
        'asyncio.run(main())',
        '',
    ].join('\n');

    const output = await spawnChecked(python, ['-c', script], {
        cwd: engineDir,
        env: {
            ...process.env,
            HERMES_HOME: e2eHermesHome(),
            OPENROUTER_API_KEY: 'sk-or-v1-tavern-e2e-mock-key',
            PYTHONPATH: engineDir,
        },
    });

    const logLine = output.split('\n').find((line) => line.startsWith('WEB_EXTRACT_LLM_CALL '));
    if (!logLine) {
        throw new Error(`Missing web_extract LLM call log:\n${output}`);
    }

    return JSON.parse(logLine.slice('WEB_EXTRACT_LLM_CALL '.length)) as {
        model: string;
        task: string;
    };
}

function e2eHermesHome() {
    const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
    const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
    return path.join(workspaceRoot, '.context', 'e2e', runId, 'tavern-runtime', 'hermes', 'home');
}

function spawnChecked(
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv }
) {
    return new Promise<string>((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const output: string[] = [];
        child.stdout.on('data', (chunk) => output.push(String(chunk)));
        child.stderr.on('data', (chunk) => output.push(String(chunk)));
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve(output.join(''));
                return;
            }
            reject(new Error(`${command} exited ${code ?? 'without code'}:\n${output.join('')}`));
        });
    });
}
