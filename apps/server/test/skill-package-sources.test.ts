import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { normalizeClawHubSlug } from '../src/skills/package-sources.ts';

test('normalizeClawHubSlug explains owner/repo paths belong on GitHub', () => {
    assert.equal(normalizeClawHubSlug('clawhub:code-review'), 'code-review');

    assert.throws(
        () => normalizeClawHubSlug('steipete/gog'),
        /Use a single ClawHub slug, or switch to GitHub for owner\/repo paths/u
    );
});
