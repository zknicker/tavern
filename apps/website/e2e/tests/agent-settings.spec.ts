import type { Page } from '@playwright/test';
import { expect, test } from '../support/test.ts';

test('legacy agent settings routes land on the Members profile', async ({ page }) => {
    await page.goto('/settings/agent');
    await expect(page).toHaveURL(/\/members/);

    await openPrimaryAgentProfile(page);

    await expect(page.getByRole('combobox', { name: 'Agent model' })).toBeVisible();
    // Unsupported legacy engine controls stay hidden in the profile.
    await expect(page.getByText('Fallback models')).toHaveCount(0);
    await expect(page.getByText('Web page summarizer')).toHaveCount(0);
    await expect(page.getByText('Context compression')).toHaveCount(0);
    await expect(page.getByText('Tool approvals')).toHaveCount(0);
    await expect(page.getByText('Subagent model')).toHaveCount(0);
});

test('agent model select saves and reflects the selected Runtime model', async ({ page }) => {
    test.setTimeout(60_000);

    const originalModel = await readPrimaryAgentModel();
    const targetModel = { label: 'GPT-5.5 openai', model: 'gpt-5.5', provider: 'openai' };

    await openPrimaryAgentProfile(page);
    await expect(page.getByText('Thinking')).toBeVisible();

    try {
        const modelSelect = agentModelSelect(page);
        await expect(modelSelect).toBeVisible();
        await modelSelect.click();
        await page.getByRole('option', { name: targetModel.label }).click();

        await expect(modelSelect).toContainText('GPT-5.5');
        await expect
            .poll(readPrimaryAgentModelName, { timeout: 30_000 })
            .toMatchObject({ model: targetModel.model, provider: targetModel.provider });

        await page.reload();
        await expect(page.getByText('Thinking')).toBeVisible();
        await expect(agentModelSelect(page)).toContainText('GPT-5.5');
    } finally {
        await restorePrimaryAgentModel(page, originalModel);
    }
});

// The Members page hosts the per-agent profile; the primary (first seeded)
// agent's row opens /members/agents/:agentId.
async function openPrimaryAgentProfile(page: Page) {
    const primary = await readPrimaryAgentModel();

    if (!primary) {
        throw new Error('No seeded agent available.');
    }

    await page.goto(`/members/agents/${primary.agentId}`);
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
}

function agentModelSelect(page: Page) {
    return page.getByRole('combobox', { name: 'Agent model' });
}

async function readPrimaryAgentModelName() {
    return (await readPrimaryAgentModel())?.modelName ?? null;
}

async function readPrimaryAgentModel() {
    const runtimeUrl = process.env.TAVERN_RUNTIME_URL ?? 'http://127.0.0.1:18790';
    const response = await fetch(`${runtimeUrl}/agents`, {
        headers: {
            authorization: `Bearer ${process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token'}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Agents request failed with ${response.status}.`);
    }

    const body = (await response.json()) as {
        agents: Array<{
            id: string;
            modelName?: { model: string; provider: string } | null;
        }>;
    };
    const agent = body.agents[0] ?? null;
    return agent ? { agentId: agent.id, modelName: agent.modelName ?? null } : null;
}

async function restorePrimaryAgentModel(
    page: Page,
    state: { agentId: string; modelName: { model: string; provider: string } | null } | null
) {
    if (!state?.modelName) {
        return;
    }

    const optionName = modelOptionName(state.modelName);

    if (!optionName) {
        await savePrimaryAgentModel(state);
        return;
    }

    await openPrimaryAgentProfile(page);
    const modelSelect = agentModelSelect(page);
    await expect(modelSelect).toBeVisible();
    await modelSelect.click();
    await page.getByRole('option', { name: optionName }).click();

    await expect
        .poll(readPrimaryAgentModelName, { timeout: 30_000 })
        .toMatchObject(state.modelName);
}

async function savePrimaryAgentModel(
    state: { agentId: string; modelName: { model: string; provider: string } | null } | null
) {
    if (!state?.modelName) {
        return;
    }

    const runtimeUrl = process.env.TAVERN_RUNTIME_URL ?? 'http://127.0.0.1:18790';
    const response = await fetch(`${runtimeUrl}/agents/${state.agentId}/model`, {
        body: JSON.stringify({ model: state.modelName }),
        headers: {
            authorization: `Bearer ${process.env.TAVERN_RUNTIME_TOKEN ?? 'e2e-runtime-token'}`,
            'content-type': 'application/json',
        },
        method: 'PATCH',
    });

    if (!response.ok) {
        throw new Error(`Agent model restore failed with ${response.status}.`);
    }
}

function modelOptionName(modelName: { model: string; provider: string }) {
    const modelLabels = new Map([
        ['gpt-4.1', 'GPT-4.1'],
        ['gpt-4.1-mini', 'GPT-4.1 Mini'],
        ['gpt-4o', 'GPT-4o'],
        ['gpt-4o-mini', 'GPT-4o Mini'],
        ['gpt-5.5', 'GPT-5.5'],
        ['gpt-5.5-pro', 'GPT-5.5 Pro'],
        ['gpt-5.4', 'GPT-5.4'],
        ['gpt-5.4-mini', 'GPT-5.4 Mini'],
    ]);
    const label = modelLabels.get(modelName.model);

    return label ? `${label} ${modelName.provider}` : null;
}
