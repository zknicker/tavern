import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemanticMemorySettingsCard } from './page.tsx';

test('SemanticMemorySettingsCard renders path setting and Memory status', () => {
    const markup = renderToStaticMarkup(
        <SemanticMemorySettingsCard
            isSaving={false}
            onSave={() => undefined}
            settings={{
                configSource: 'settings',
                configuredPath: '~/.tavern/runtime/memory',
                effectivePath: '/Users/zknicker/.tavern/runtime/memory',
                environmentPath: null,
                updatedAt: '2026-06-17T12:00:00.000Z',
            }}
            status={{
                configSource: 'settings',
                freshness: {
                    live: true,
                    reason: null,
                    state: 'watching',
                },
                indexExists: true,
                pageCount: 42,
                readable: true,
                memoryPath: '/Users/zknicker/.tavern/runtime/memory',
                writable: true,
            }}
        />
    );

    assert.match(markup, /Memory path/);
    assert.match(markup, /Effective path/);
    assert.match(markup, /Settings/);
    assert.match(markup, /Markdown pages/);
    assert.match(markup, /TAXONOMY.md/);
    assert.doesNotMatch(markup, /Active topics/);
    assert.doesNotMatch(markup, /Runtime crons/);
});
