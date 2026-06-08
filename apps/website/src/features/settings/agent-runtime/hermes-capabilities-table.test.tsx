import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HermesCapabilitiesSummary } from './hermes-capabilities-table.tsx';

function capability(input: {
    capability: 'apiServer' | 'dashboardServer' | 'gateway' | 'models' | 'skills';
    state?: 'degraded' | 'healthy' | 'unknown' | 'unavailable';
}) {
    return {
        capability: input.capability,
        checkedAt: '2026-05-28T12:00:00.000Z',
        errorCode: null,
        lastHealthyAt: null,
        metadataJson: '{}',
        method: 'runtime.capabilities',
        reason: null,
        runtimeId: 'runtime-1',
        state: input.state ?? 'healthy',
        technicalMessage: null,
        updatedAt: '2026-05-28T12:00:00.000Z',
    };
}

test('HermesCapabilitiesSummary renders per-capability refresh actions', () => {
    const markup = renderToStaticMarkup(
        <HermesCapabilitiesSummary
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

test('HermesCapabilitiesSummary groups by category', () => {
    const markup = renderToStaticMarkup(
        <HermesCapabilitiesSummary
            capabilities={[
                capability({ capability: 'dashboardServer' }),
                capability({ capability: 'models', state: 'unknown' }),
                capability({ capability: 'apiServer' }),
                capability({ capability: 'gateway' }),
                capability({ capability: 'skills' }),
            ]}
        />
    );

    assert.ok(markup.indexOf('Runtime core') < markup.indexOf('Skills &amp; models'));
    assert.doesNotMatch(markup, /Required/);
    assert.doesNotMatch(markup, /Supporting/);
});
