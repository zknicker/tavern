import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CortexSchemaAdditions } from './page.tsx';

test('CortexSchemaAdditions renders runtime-added schema terms for review', () => {
    const markup = renderToStaticMarkup(
        <CortexSchemaAdditions
            additions={[
                {
                    createdAt: '2026-06-04T12:00:00.000Z',
                    example: {
                        title: 'Podcast Automation Lesson',
                    },
                    id: 'ctxterm_1',
                    kind: 'page-type',
                    name: 'podcast-episode',
                    reason: 'A Cortex capture introduced page type "podcast-episode".',
                    sourceRefs: [{ id: 'msg-1', kind: 'message', locator: null }],
                    updatedAt: '2026-06-04T12:00:00.000Z',
                    usageCount: 3,
                },
            ]}
            error={null}
        />
    );

    assert.match(markup, /Schema Additions/);
    assert.match(markup, /podcast-episode/);
    assert.match(markup, /Page type/);
    assert.match(markup, /title: Podcast Automation Lesson/);
    assert.match(markup, /3 usage/);
});

test('CortexSchemaAdditions stays hidden when there is nothing to review', () => {
    const markup = renderToStaticMarkup(<CortexSchemaAdditions additions={[]} error={null} />);

    assert.equal(markup, '');
});
