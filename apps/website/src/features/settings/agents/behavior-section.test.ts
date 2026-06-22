import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import {
    clampCompression,
    formatWebExtractSummarizerRef,
    listWebExtractSummarizerChoices,
    resolveTimezoneSelection,
    type WebExtractSummarizerSettings,
} from './behavior-section.tsx';

const models = [
    {
        availability: 'available',
        contextWindow: null,
        framework: 'hermes',
        id: 'custom/tavern-e2e-tools',
        modelId: 'tavern-e2e-tools',
        name: 'tavern-e2e-tools',
        provider: 'custom',
        reasoning: null,
        ref: 'custom/tavern-e2e-tools',
        supportsChatRouting: true,
    },
    {
        availability: 'available',
        contextWindow: null,
        framework: 'hermes',
        id: 'custom/tavern-e2e-web-extract',
        modelId: 'tavern-e2e-web-extract',
        name: 'tavern-e2e-web-extract',
        provider: 'custom',
        reasoning: null,
        ref: 'custom/tavern-e2e-web-extract',
        supportsChatRouting: true,
    },
] satisfies ModelListOutput['models'];

test('resolveTimezoneSelection maps the system sentinel to null', () => {
    assert.equal(resolveTimezoneSelection('__system__'), null);
});

test('resolveTimezoneSelection keeps explicit timezones', () => {
    assert.equal(resolveTimezoneSelection('America/Los_Angeles'), 'America/Los_Angeles');
});

test('clampCompression keeps in-range values unchanged', () => {
    assert.deepEqual(
        clampCompression({ enabled: true, protectLastMessages: 20, thresholdPercent: 80 }),
        { enabled: true, protectLastMessages: 20, thresholdPercent: 80 }
    );
});

test('clampCompression clamps the threshold to 10-95', () => {
    assert.equal(
        clampCompression({ enabled: true, protectLastMessages: 20, thresholdPercent: 120 })
            .thresholdPercent,
        95
    );
    assert.equal(
        clampCompression({ enabled: true, protectLastMessages: 20, thresholdPercent: 3 })
            .thresholdPercent,
        10
    );
});

test('clampCompression clamps protected messages to 0-400', () => {
    assert.equal(
        clampCompression({ enabled: true, protectLastMessages: 999, thresholdPercent: 80 })
            .protectLastMessages,
        400
    );
    assert.equal(
        clampCompression({ enabled: true, protectLastMessages: -5, thresholdPercent: 80 })
            .protectLastMessages,
        0
    );
});

test('clampCompression rounds fractional values and preserves enabled', () => {
    assert.deepEqual(
        clampCompression({ enabled: false, protectLastMessages: 19.6, thresholdPercent: 80.4 }),
        { enabled: false, protectLastMessages: 20, thresholdPercent: 80 }
    );
});

test('listWebExtractSummarizerChoices keeps the fast recommended model first', () => {
    const choices = listWebExtractSummarizerChoices({ current: null, models });

    assert.deepEqual(
        choices.map((choice) => choice.ref),
        [
            'openrouter/google/gemini-3-flash-preview',
            'custom/tavern-e2e-tools',
            'custom/tavern-e2e-web-extract',
        ]
    );
});

test('listWebExtractSummarizerChoices preserves a current model outside the catalog', () => {
    const current: WebExtractSummarizerSettings = {
        model: 'external-fast',
        provider: 'custom-provider',
        timeoutSeconds: 360,
    };

    const choices = listWebExtractSummarizerChoices({ current, models });

    assert.ok(choices.some((choice) => choice.ref === 'custom-provider/external-fast'));
});

test('formatWebExtractSummarizerRef uses the engine provider/model ref shape', () => {
    assert.equal(
        formatWebExtractSummarizerRef({
            model: 'google/gemini-3-flash-preview',
            provider: 'openrouter',
        }),
        'openrouter/google/gemini-3-flash-preview'
    );
});
