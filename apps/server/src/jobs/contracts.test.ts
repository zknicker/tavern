import { describe, expect, test } from 'bun:test';
import { jobSlugSchema } from './contracts.ts';

describe('jobSlugSchema', () => {
    test('includes Runtime-owned Cortex jobs for app-side audit surfaces', () => {
        expect(jobSlugSchema.parse('cortex-generate-embeddings')).toBe(
            'cortex-generate-embeddings'
        );
        expect(jobSlugSchema.parse('cortex-sync')).toBe('cortex-sync');
        expect(jobSlugSchema.parse('cortex-lint')).toBe('cortex-lint');
        expect(jobSlugSchema.parse('cortex-repair-derived-state')).toBe(
            'cortex-repair-derived-state'
        );
        expect(jobSlugSchema.parse('cortex-chat-ingestion')).toBe('cortex-chat-ingestion');
        expect(jobSlugSchema.parse('cortex-dream')).toBe('cortex-dream');
        expect(jobSlugSchema.parse('refresh-runtime-capabilities')).toBe(
            'refresh-runtime-capabilities'
        );
    });
});
