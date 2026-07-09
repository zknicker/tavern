import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MemoryOverview } from './memory-overview.tsx';

test('MemoryOverview renders Aside-style memory settings and hub status', () => {
    const markup = renderToStaticMarkup(
        <MemoryRouter>
            <MemoryOverview
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
                    wikiPath: '/Users/zknicker/.tavern/runtime/memory',
                    writable: true,
                }}
            />
        </MemoryRouter>
    );

    assert.match(markup, /Enable memories/);
    assert.match(markup, /Episodic retention/);
    assert.match(markup, /Open Automations/);
    assert.match(markup, /Open Wiki/);
    assert.match(markup, /Settings/);
    assert.match(markup, /Recent runs/);
    assert.match(markup, /Browse files/);
});
