import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentCapabilitiesSummary } from './agent-capabilities-table.tsx';

function capability(input: {
    capability: 'apiServer' | 'dashboardServer' | 'gateway' | 'modelExecution' | 'skills' | 'vault';
    displayName?: string;
    state?: 'degraded' | 'healthy' | 'unknown' | 'unavailable';
}) {
    return {
        capability: input.capability,
        checkedAt: '2026-05-28T12:00:00.000Z',
        displayName: input.displayName ?? null,
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

test('AgentCapabilitiesSummary renders per-capability refresh actions', () => {
    const markup = renderToStaticMarkup(
        <AgentCapabilitiesSummary
            capabilities={[
                {
                    capability: 'vault',
                    checkedAt: '2026-05-28T12:00:00.000Z',
                    displayName: 'Vault',
                    errorCode: null,
                    lastHealthyAt: null,
                    metadataJson: '{}',
                    method: 'runtime.capabilities',
                    reason: 'Vault path is not readable and writable.',
                    runtimeId: 'runtime-1',
                    state: 'unavailable',
                    technicalMessage: null,
                    updatedAt: '2026-05-28T12:00:00.000Z',
                },
            ]}
            onCapabilityRefresh={() => undefined}
        />
    );

    assert.match(markup, /Refresh Vault/);
    assert.match(markup, /Vault/);
});

test('AgentCapabilitiesSummary groups by category', () => {
    const markup = renderToStaticMarkup(
        <AgentCapabilitiesSummary
            capabilities={[
                capability({ capability: 'dashboardServer' }),
                capability({ capability: 'modelExecution', state: 'unknown' }),
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

test('AgentCapabilitiesSummary prefers runtime display names and falls back to ids', () => {
    const markup = renderToStaticMarkup(
        <AgentCapabilitiesSummary
            capabilities={[
                capability({ capability: 'dashboardServer', displayName: 'Agent engine' }),
                capability({ capability: 'gateway' }),
            ]}
        />
    );

    assert.match(markup, /Agent engine/);
    assert.match(markup, /gateway/);
});
