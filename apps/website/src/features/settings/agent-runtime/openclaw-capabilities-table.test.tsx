import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenClawCapabilitiesSummary } from './openclaw-capabilities-table.tsx';

test('OpenClawCapabilitiesSummary renders per-capability refresh actions', () => {
    const markup = renderToStaticMarkup(
        <OpenClawCapabilitiesSummary
            capabilities={[
                {
                    capability: 'embeddingModel',
                    checkedAt: '2026-05-28T12:00:00.000Z',
                    errorCode: null,
                    lastHealthyAt: null,
                    metadataJson: '{}',
                    method: 'runtime.capabilities',
                    reason: 'OpenAI API key is not configured for Cortex embeddings.',
                    runtimeId: 'runtime-1',
                    state: 'unavailable',
                    technicalMessage: null,
                    updatedAt: '2026-05-28T12:00:00.000Z',
                },
            ]}
            onCapabilityRefresh={() => undefined}
        />
    );

    assert.match(markup, /Refresh embedding model/);
    assert.match(markup, /embedding model/);
});
