import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentCapabilitiesSummary, CapabilityTooltipContent } from './agent-capabilities-table.tsx';

function capability(input: {
    capability: 'apiServer' | 'dashboardServer' | 'gateway' | 'modelExecution' | 'skills';
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
                    capability: 'skills',
                    checkedAt: '2026-05-28T12:00:00.000Z',
                    displayName: 'Memory',
                    errorCode: null,
                    lastHealthyAt: null,
                    metadataJson: '{}',
                    method: 'runtime.capabilities',
                    reason: 'Wiki path is not readable and writable.',
                    runtimeId: 'runtime-1',
                    state: 'unavailable',
                    technicalMessage: null,
                    updatedAt: '2026-05-28T12:00:00.000Z',
                },
            ]}
            onCapabilityRefresh={() => undefined}
        />
    );

    assert.match(markup, /Refresh Memory/);
    assert.match(markup, /Memory/);
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

test('AgentCapabilitiesSummary renders a provisioning progress bar from capability metadata', () => {
    const markup = renderToStaticMarkup(
        <AgentCapabilitiesSummary
            capabilities={[
                {
                    capability: 'skills',
                    checkedAt: '2026-05-28T12:00:00.000Z',
                    displayName: 'Skills',
                    errorCode: null,
                    lastHealthyAt: null,
                    metadataJson: '{"phase":"downloading-model","progress":0.42}',
                    method: 'runtime.capabilities',
                    reason: 'Downloading the recall model (42%).',
                    runtimeId: 'runtime-1',
                    state: 'degraded',
                    technicalMessage: null,
                    updatedAt: '2026-05-28T12:00:00.000Z',
                },
            ]}
        />
    );

    assert.match(markup, /Skills/);
    assert.match(markup, /progressbar/);
    assert.match(markup, /42%/);
});

test('AgentCapabilitiesSummary ignores progress metadata on healthy capabilities', () => {
    const markup = renderToStaticMarkup(
        <AgentCapabilitiesSummary
            capabilities={[
                {
                    capability: 'skills',
                    checkedAt: '2026-05-28T12:00:00.000Z',
                    displayName: 'Skills',
                    errorCode: null,
                    lastHealthyAt: null,
                    metadataJson: '{"phase":"ready"}',
                    method: 'runtime.capabilities',
                    reason: null,
                    runtimeId: 'runtime-1',
                    state: 'healthy',
                    technicalMessage: null,
                    updatedAt: '2026-05-28T12:00:00.000Z',
                },
            ]}
        />
    );

    assert.doesNotMatch(markup, /progressbar/);
});

test('CapabilityTooltipContent leads with the customer-facing capability explainer', () => {
    const markup = renderToStaticMarkup(
        <CapabilityTooltipContent
            capability={{
                capability: 'skills',
                checkedAt: '2026-05-28T12:00:00.000Z',
                displayName: 'Skills',
                errorCode: null,
                lastHealthyAt: null,
                metadataJson: '{"phase":"ready"}',
                method: 'runtime.capabilities',
                reason: null,
                runtimeId: 'runtime-1',
                state: 'healthy',
                technicalMessage: null,
                updatedAt: '2026-05-28T12:00:00.000Z',
            }}
        />
    );

    assert.match(markup, /Reusable skills agents load/);
    assert.match(markup, /Healthy/);
});
