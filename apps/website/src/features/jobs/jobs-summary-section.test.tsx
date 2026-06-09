import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JobsSummarySection } from './jobs-summary-section.tsx';

test('JobsSummarySection renders each operational job with its cadence and next run', () => {
    const now = Date.now;

    Date.now = () => Date.parse('2026-04-22T18:00:00.000Z');

    try {
        const markup = renderToStaticMarkup(
            <JobsSummarySection
                jobs={[
                    {
                        availability: 'enabled',
                        counts: {
                            active: 0,
                            completed: 3,
                            delayed: 0,
                            failed: 1,
                            waiting: 0,
                        },
                        description: 'Syncs OpenRouter usage totals for Settings.',
                        disabledReason: null,
                        displayName: 'Sync OpenRouter Usage',
                        latestRun: {
                            attemptsMade: 0,
                            createdAt: '2026-04-22T17:29:55.618Z',
                            durationMs: 220,
                            error: null,
                            finishedAt: '2026-04-22T17:29:55.838Z',
                            id: 'run-1',
                            progress: 100,
                            startedAt: '2026-04-22T17:29:55.618Z',
                            state: 'completed',
                        },
                        queueName: 'sync-openrouter-usage',
                        schedule: {
                            everyMs: 3_600_000,
                            kind: 'interval',
                            nextRunAt: '2026-04-22T19:00:00.000Z',
                            runOnStart: true,
                        },
                        slug: 'sync-openrouter-usage',
                    },
                ]}
                onSelectJob={() => undefined}
            />
        );

        assert.match(markup, /Operational Jobs/);
        assert.match(markup, /Sync OpenRouter Usage/);
        assert.match(markup, /every 1h/);
        assert.match(markup, /runs on startup/);
        assert.match(markup, /1 failed/);
        assert.match(markup, /in 1h/);
        assert.match(markup, /bg-success/);
    } finally {
        Date.now = now;
    }
});

test('JobsSummarySection renders disabled job reasons inline', () => {
    const markup = renderToStaticMarkup(
        <JobsSummarySection
            jobs={[
                {
                    availability: 'disabled',
                    counts: {
                        active: 0,
                        completed: 0,
                        delayed: 0,
                        failed: 0,
                        waiting: 0,
                    },
                    description: 'Refreshes Runtime capability health.',
                    disabledReason: 'Runtime is paused.',
                    displayName: 'Refresh Runtime Capabilities',
                    latestRun: null,
                    queueName: 'refresh-runtime-capabilities',
                    schedule: {
                        everyMs: 900_000,
                        kind: 'interval',
                        nextRunAt: null,
                        runOnStart: true,
                    },
                    slug: 'refresh-runtime-capabilities',
                },
            ]}
            onSelectJob={() => undefined}
        />
    );

    assert.match(markup, /Refresh Runtime Capabilities/);
    assert.match(markup, /Disabled/);
    assert.match(markup, /Runtime is paused/);
});
