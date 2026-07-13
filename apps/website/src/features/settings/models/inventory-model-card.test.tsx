import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { InventoryModelCard } from './inventory-model-card.tsx';

test('InventoryModelCard renders model metadata', () => {
    const markup = renderToStaticMarkup(
        <InventoryModelCard
            model={{
                canDelete: false,
                capabilities: ['general'],
                capability: 'agent',
                contextWindow: 200_000,
                description: null,
                displayName: 'GPT 5.5',
                inUse: false,
                modelId: 'gpt-5.5',
                provider: 'codex',
                ref: 'codex/gpt-5.5',
                usageLabels: [],
            }}
            providerId="codex"
        />
    );

    assert.match(markup, /GPT 5.5/);
    assert.match(markup, /codex\/gpt-5.5/);
    assert.match(markup, /200K context/);
});
