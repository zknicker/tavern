import { describe, expect, test } from 'bun:test';
import { jobSlugSchema } from './contracts.ts';

describe('jobSlugSchema', () => {
    test('includes Runtime-owned operational jobs', () => {
        expect(jobSlugSchema.parse('refresh-runtime-capabilities')).toBe(
            'refresh-runtime-capabilities'
        );
        expect(jobSlugSchema.parse('tavern-highlights')).toBe('tavern-highlights');
    });

    test('rejects unknown jobs', () => {
        expect(() => jobSlugSchema.parse('unknown-job')).toThrow();
    });
});
