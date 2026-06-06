import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { InventoryModelCard } from './inventory-model-card.tsx';

test('InventoryModelCard renders a tooltip trigger for usage-locked delete actions', () => {
    const markup = renderToStaticMarkup(
        <InventoryModelCard
            isDeleting={false}
            model={{
                canDelete: false,
                capabilities: ['general'],
                contextWindow: 200_000,
                description: null,
                displayName: 'GPT-5.4',
                inUse: true,
                modelId: 'gpt-5.4',
                provider: 'codex',
                ref: 'codex/gpt-5.4',
                usageLabels: ['Shared default chat model', 'Memory working model'],
            }}
            onDelete={() => {}}
            providerId="codex"
        />
    );

    assert.match(markup, /data-slot="tooltip-trigger"/);
    assert.match(markup, /pointer-events-none/);
    assert.match(markup, /Delete GPT-5.4/);
});
