import { expect, test } from 'bun:test';
import { jobDefinitions } from '../../../jobs/index.ts';
import { jobSlugSchema, runJobInputSchema } from '../src/jobs/contracts.ts';

test('registered jobs are limited to provider usage imports', () => {
    expect(jobDefinitions.map((job) => job.slug)).toEqual([
        'sync-codex-usage',
        'sync-openrouter-usage',
    ]);
});

test('job route input accepts usage jobs and rejects removed runtime sync jobs', () => {
    expect(
        runJobInputSchema.parse({
            slug: 'sync-openrouter-usage',
        })
    ).toEqual({
        slug: 'sync-openrouter-usage',
    });

    expect(() => jobSlugSchema.parse('sync-runtime-sessions')).toThrow();
    expect(() =>
        runJobInputSchema.parse({
            slug: 'sync-runtime-agents',
        })
    ).toThrow();
});
