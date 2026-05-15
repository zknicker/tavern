import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { memoryTabs } from './memory-tabs.ts';

test('memory tab shell exposes the three Phase 0 empty states', () => {
    assert.deepEqual(
        memoryTabs.map((tab) => tab.value),
        ['activity', 'bulletin', 'durable']
    );

    for (const tab of memoryTabs) {
        assert.equal(tab.emptyState.length > 0, true);
        assert.equal(tab.description.length > 0, true);
        assert.equal(tab.title.length > 0, true);
    }
});
