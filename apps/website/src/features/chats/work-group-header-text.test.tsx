import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkGroupHeaderText, WorkGroupHeaderTextView } from './work-group-header-text.tsx';

test('WorkGroupHeaderText primes active slot text without hiding the fallback label', () => {
    const markup = renderToStaticMarkup(
        <WorkGroupHeaderTextView
            canSlot={true}
            isActive={true}
            label="Running tests"
            slotReady={false}
        />
    );

    assert.match(markup, />Running tests</);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /aria-label="Running tests"/);
});

test('WorkGroupHeaderText renders inactive labels without slot text', () => {
    const markup = renderToStaticMarkup(<WorkGroupHeaderText isActive={false} label="Ran tests" />);

    assert.match(markup, />Ran tests</);
    assert.doesNotMatch(markup, /aria-hidden="true"/);
});
