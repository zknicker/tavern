import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenClawCapabilitiesSummary } from './openclaw-capabilities-table.tsx';

function capability(input: {
    capability: 'codexOAuth' | 'gateway' | 'logs' | 'models' | 'skills' | 'status' | 'tavernPlugin';
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

test('OpenClawCapabilitiesSummary groups by category', () => {
    const markup = renderToStaticMarkup(
        <OpenClawCapabilitiesSummary
            capabilities={[
                capability({ capability: 'logs' }),
                capability({ capability: 'models', state: 'unknown' }),
                capability({ capability: 'gateway' }),
                capability({ capability: 'skills' }),
            ]}
        />
    );

    assert.ok(markup.indexOf('Runtime core') < markup.indexOf('Skills &amp; models'));
    assert.ok(markup.indexOf('Skills &amp; models') < markup.indexOf('Operations'));
    assert.doesNotMatch(markup, /Required/);
    assert.doesNotMatch(markup, /Supporting/);
});

test('OpenClawCapabilitiesSummary keeps static order when capability health changes', () => {
    const renderRuntimeCore = (gatewayState: 'healthy' | 'unavailable') =>
        renderToStaticMarkup(
            <OpenClawCapabilitiesSummary
                capabilities={[
                    capability({ capability: 'codexOAuth' }),
                    capability({ capability: 'gateway', state: gatewayState }),
                    capability({ capability: 'status' }),
                    capability({ capability: 'tavernPlugin' }),
                ]}
            />
        );
    const unavailableMarkup = renderRuntimeCore('unavailable');
    const healthyMarkup = renderRuntimeCore('healthy');

    for (const markup of [unavailableMarkup, healthyMarkup]) {
        assert.ok(markup.indexOf('status') < markup.indexOf('gateway'));
        assert.ok(markup.indexOf('gateway') < markup.indexOf('tavernPlugin'));
        assert.ok(markup.indexOf('tavernPlugin') < markup.indexOf('codexOAuth'));
    }
});
