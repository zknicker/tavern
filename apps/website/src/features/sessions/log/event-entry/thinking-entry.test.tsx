import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThinkingLogEntry } from './thinking-entry.tsx';

test('ThinkingLogEntry renders a compact inspectable indicator by default', () => {
    const markup = renderToStaticMarkup(
        <ThinkingLogEntry
            entry={{
                id: 'thinking-1',
                kind: 'system',
                systemKind: 'thinking',
                thinking: {
                    id: 'thinking-1',
                    messageId: 'message-1',
                    sender: 'Claw',
                    text: 'Simple greeting.',
                    timestamp: '2026-04-19T23:34:30.543Z',
                },
                timestamp: '2026-04-19T23:34:30.543Z',
            }}
        />
    );

    assert.match(markup, /Thinking/);
    assert.match(markup, /Inspect/);
    assert.match(markup, /aria-expanded="false"/);
    assert.doesNotMatch(markup, /Simple greeting\./);
});
