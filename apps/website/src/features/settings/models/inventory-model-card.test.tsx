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
                contextWindow: 200_000,
                description: null,
                displayName: 'Claude Sonnet 4.6',
                inUse: true,
                modelId: 'claude-sonnet-4-6',
                provider: 'claude',
                ref: 'claude/claude-sonnet-4-6',
                usageLabels: ['Shared default chat model', 'Memory working model'],
            }}
            onDelete={() => {}}
            providerId="claude"
        />
    );

    assert.match(markup, /data-slot="tooltip-trigger"/);
    assert.match(markup, /pointer-events-none/);
    assert.match(markup, /Delete Claude Sonnet 4.6/);
});
