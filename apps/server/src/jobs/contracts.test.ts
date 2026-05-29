import { describe, expect, test } from 'bun:test';
import { jobSlugSchema } from './contracts.ts';

describe('jobSlugSchema', () => {
    test('includes Runtime-owned Cortex jobs for app-side audit surfaces', () => {
        expect(jobSlugSchema.parse('cortex-generate-embeddings')).toBe(
            'cortex-generate-embeddings'
        );
        expect(jobSlugSchema.parse('cortex-sync')).toBe('cortex-sync');
        expect(jobSlugSchema.parse('cortex-lint')).toBe('cortex-lint');
        expect(jobSlugSchema.parse('cortex-maintenance')).toBe('cortex-maintenance');
        expect(jobSlugSchema.parse('cortex-signal')).toBe('cortex-signal');
        expect(jobSlugSchema.parse('cortex-dream')).toBe('cortex-dream');
        expect(jobSlugSchema.parse('refresh-runtime-capabilities')).toBe(
            'refresh-runtime-capabilities'
        );
    });
});
