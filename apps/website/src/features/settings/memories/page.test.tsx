import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemoryJobDetail } from '@tavern/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { memoryJobKindLabel, memoryJobTitle } from './memory-job-copy.ts';
import { MemoryJobDetailBody } from './memory-job-detail.tsx';

const baseJob: MemoryJobDetail = {
    agentId: 'agt_primary',
    agentParticipantId: 'agt_primary',
    chatId: 'cht_plans',
    completedAt: '2026-07-02T20:10:00.000Z',
    createdAt: '2026-07-02T20:05:00.000Z',
    error: null,
    fileChangeCount: 0,
    fileChanges: [],
    id: 'memjob_1',
    kind: 'extraction',
    metadata: {
        extractionMode: 'observations',
        observations: '- [3] Zach prefers deploys from the Mac mini.',
    },
    model: { model: 'fast-mini', provider: 'openai' },
    modelCategory: 'fast',
    outputPath: '.memory/episodic/2026-07-02.md',
    sourceEndSequence: 4,
    sourceStartSequence: 1,
    status: 'completed',
    transcript: null,
    updatedAt: '2026-07-02T20:10:00.000Z',
    usage: {},
};

function renderBody(job: MemoryJobDetail) {
    return renderToStaticMarkup(
        <MemoryRouter>
            <MemoryJobDetailBody job={job} />
        </MemoryRouter>
    );
}

test('capture detail shows what was saved in plain language', () => {
    const markup = renderBody(baseJob);

    assert.match(markup, /Saved to memory/);
    assert.match(markup, /prefers deploys from the Mac mini/);
    assert.match(markup, /Open chat/);
    assert.doesNotMatch(markup, /extraction/i);
    assert.doesNotMatch(markup, /Transcript/);
    assert.doesNotMatch(markup, /Metadata/);
});

test('dream detail shows the per-run summary and file changes, not process narration', () => {
    const markup = renderBody({
        ...baseJob,
        chatId: null,
        fileChangeCount: 2,
        fileChanges: [
            { afterHash: 'h2', beforeHash: 'h1', path: 'people/zach.md' },
            { afterHash: 'h3', beforeHash: null, path: 'projects/tavern.md' },
        ],
        kind: 'dream',
        metadata: { summary: 'Promoted deploy preference to USER.md.' },
        modelCategory: 'standard',
        transcript: {
            text: 'Done.',
            toolCalls: [
                { input: {}, toolCallId: 'c1', toolName: 'memory_list_episodic' },
                {
                    input: { path: 'people/zach.md' },
                    toolCallId: 'c2',
                    toolName: 'wiki_write',
                },
            ],
        },
    });

    assert.match(markup, /Promoted deploy preference/);
    assert.match(markup, /Updated people\/zach.md/);
    assert.match(markup, /Created projects\/tavern.md/);
    assert.doesNotMatch(markup, /Steps/);
    assert.doesNotMatch(markup, /toolCallId/);
});

test('skipped reviews read as nothing new instead of a failure', () => {
    const markup = renderBody({
        ...baseJob,
        metadata: { extractionMode: 'observations', reason: 'no_durable_observations' },
        status: 'skipped',
    });

    assert.match(markup, /Nothing new to save/);
    assert.doesNotMatch(markup, /Saved to memory/);
});

test('memory job copy distinguishes kinds without worker jargon', () => {
    assert.equal(memoryJobTitle({ ...baseJob, kind: 'dream' }, null), 'Organized memory');
    assert.equal(memoryJobTitle(baseJob, 'Release plans'), 'Remembered from “Release plans”');
    assert.equal(memoryJobKindLabel(baseJob), 'Capture');
    assert.equal(memoryJobKindLabel({ ...baseJob, kind: 'dream' }), 'Dream');
});
