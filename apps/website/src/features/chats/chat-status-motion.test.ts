import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMinimumDwell } from './chat-status-motion.tsx';

const keyOf = (item: { id: string }) => item.id;

test('minimum dwell holds a just-appeared item through removal', () => {
    const held = new Map<string, { item: { id: string }; shownAt: number }>();
    const otto = { id: 'agt_otto' };

    // Appears at t=0.
    resolveMinimumDwell({ held, holdMs: 600, items: [otto], keyOf, now: 0 });

    // Removed at t=100: still displayed, expiry scheduled for t=600.
    const heldResult = resolveMinimumDwell({ held, holdMs: 600, items: [], keyOf, now: 100 });
    assert.deepEqual(heldResult.display, [otto]);
    assert.equal(heldResult.nextExpiry, 600);

    // Dwell elapsed: the item finally leaves.
    const doneResult = resolveMinimumDwell({ held, holdMs: 600, items: [], keyOf, now: 601 });
    assert.deepEqual(doneResult.display, []);
    assert.equal(doneResult.nextExpiry, null);
});

test('minimum dwell releases long-lived items immediately', () => {
    const held = new Map<string, { item: { id: string }; shownAt: number }>();
    const otto = { id: 'agt_otto' };

    resolveMinimumDwell({ held, holdMs: 600, items: [otto], keyOf, now: 0 });
    // Visible for 5s, well past the dwell: removal takes effect at once.
    const result = resolveMinimumDwell({ held, holdMs: 600, items: [], keyOf, now: 5000 });
    assert.deepEqual(result.display, []);
    assert.equal(result.nextExpiry, null);
});

test('minimum dwell keeps the original shownAt across a quick re-appearance', () => {
    const held = new Map<string, { item: { id: string }; shownAt: number }>();
    const otto = { id: 'agt_otto' };

    resolveMinimumDwell({ held, holdMs: 600, items: [otto], keyOf, now: 0 });
    resolveMinimumDwell({ held, holdMs: 600, items: [], keyOf, now: 100 });
    // Re-appears while held: the row never left, so the dwell clock does not
    // restart and a later removal is immediate.
    resolveMinimumDwell({ held, holdMs: 600, items: [otto], keyOf, now: 200 });
    const result = resolveMinimumDwell({ held, holdMs: 600, items: [], keyOf, now: 700 });
    assert.deepEqual(result.display, []);
});

test('minimum dwell keeps a held row in its original position', () => {
    const held = new Map<string, { item: { id: string }; shownAt: number }>();
    const otto = { id: 'agt_otto' };
    const wren = { id: 'agt_wren' };

    resolveMinimumDwell({ held, holdMs: 600, items: [otto, wren], keyOf, now: 0 });
    const result = resolveMinimumDwell({ held, holdMs: 600, items: [wren], keyOf, now: 100 });
    assert.deepEqual(result.display, [otto, wren]);
});
