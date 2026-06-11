import assert from 'node:assert/strict';
import test from 'node:test';
import { clampCompression, resolveTimezoneSelection } from './behavior-section.tsx';

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
