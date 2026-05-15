import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCronGetQueryOptions } from './use-cron-get.ts';

test('buildCronGetQueryOptions always refetches cron details when the editor opens', () => {
    const enabledOptions = buildCronGetQueryOptions('cron-1');
    const disabledOptions = buildCronGetQueryOptions(null);

    assert.equal(enabledOptions.enabled, true);
    assert.equal(disabledOptions.enabled, false);
    assert.equal(enabledOptions.refetchOnMount, 'always');
    assert.equal(enabledOptions.staleTime, 0);
});
