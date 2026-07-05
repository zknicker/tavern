import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTimezoneSelection } from './timezone-section.tsx';

test('resolveTimezoneSelection maps the system sentinel to null', () => {
    assert.equal(resolveTimezoneSelection('__system__'), null);
});

test('resolveTimezoneSelection keeps explicit timezones', () => {
    assert.equal(resolveTimezoneSelection('America/Los_Angeles'), 'America/Los_Angeles');
});
