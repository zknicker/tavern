import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { CodexUsageSnapshot } from '@tavern/codex-usage';
import * as codexUsage from '@tavern/codex-usage';
import * as providerUsageStorage from '../storage/provider-usage.ts';
import { loadCodexUsage } from './provider-usage-loaders.ts';

afterEach(() => {
    mock.restore();
});

test('loadCodexUsage returns cached usage without a live network read', async () => {
    const snapshot = createCodexUsageSnapshot();
    const getCodexUsage = spyOn(codexUsage, 'getCodexUsage').mockResolvedValue(
        createCodexUsageSnapshot('2026-05-27T21:01:00.000Z')
    );
    spyOn(providerUsageStorage, 'getCodexUsageSnapshot').mockResolvedValue(snapshot);

    assert.deepEqual(await loadCodexUsage(new Date('2026-05-27T21:00:00.000Z')), {
        provider: 'codex',
        snapshot,
        status: 'ok',
    });
    assert.equal(getCodexUsage.mock.calls.length, 0);
});

function createCodexUsageSnapshot(capturedAt = '2026-05-27T21:00:00.000Z'): CodexUsageSnapshot {
    return {
        capturedAt,
        creditsBalance: null,
        planType: null,
        provider: 'codex',
        source: 'chatgpt-wham-usage',
        windows: [
            {
                id: 'current-week',
                label: 'Weekly limit',
                remainingPercent: 72,
                resetAfterSeconds: null,
                resetsAt: '2026-05-30T20:13:00.000Z',
                usedPercent: 28,
            },
        ],
    };
}
