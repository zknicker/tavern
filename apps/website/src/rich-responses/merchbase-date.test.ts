import assert from 'node:assert/strict';
import test from 'node:test';
import { dateKeyFromBucketStart } from './merchbase-date.ts';

test('dateKeyFromBucketStart normalizes MerchBase ISO datetime buckets', () => {
    assert.equal(dateKeyFromBucketStart('2026-06-23T07:00:00.000Z'), '2026-06-23');
});

test('dateKeyFromBucketStart preserves date-only buckets', () => {
    assert.equal(dateKeyFromBucketStart('2026-06-23'), '2026-06-23');
});
