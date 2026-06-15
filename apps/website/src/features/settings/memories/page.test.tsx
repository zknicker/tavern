import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WikiHubStatusCard } from './page.tsx';

test('WikiHubStatusCard renders Cortex wiki hub status instead of old Cortex settings', () => {
    const markup = renderToStaticMarkup(
        <WikiHubStatusCard
            status={{
                archivedTopicCount: 1,
                configSource: 'runtime',
                hubPath: '/Users/zknicker/.tavern/wiki',
                pageCount: 42,
                readable: true,
                topicCount: 7,
                writable: true,
            }}
        />
    );

    assert.match(markup, /Hub path/);
    assert.match(markup, /Runtime managed/);
    assert.match(markup, /Active topics/);
    assert.match(markup, /Markdown pages/);
    assert.match(markup, /Tasks and Runtime crons/);
    assert.doesNotMatch(markup, /Embedding model/);
    assert.doesNotMatch(markup, /Query expansion model/);
    assert.doesNotMatch(markup, /Chat ingestion model/);
    assert.doesNotMatch(markup, /Dream model/);
    assert.doesNotMatch(markup, /Schema/);
});
