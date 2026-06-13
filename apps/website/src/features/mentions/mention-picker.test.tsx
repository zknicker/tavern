import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MentionPicker } from './mention-picker.tsx';
import type { MentionOption } from './mention-types.ts';

test('MentionPicker renders context fullness adornment for command options', () => {
    const option: MentionOption = {
        description: "Compact this thread's context (44% full)",
        id: '/context',
        insertText: '/context ',
        kind: 'command',
        label: '/context',
        projection: 'capability-reference',
        sourceLabel: 'Session',
        statusAdornment: {
            kind: 'context-fullness',
            percent: 0.44,
        },
    };
    const markup = renderToStaticMarkup(
        <MentionPicker
            activeIndex={0}
            hasQuery
            isPathSearchActive={false}
            isPathSearchLoading={false}
            onSelect={() => undefined}
            options={[option]}
        />
    );

    assert.match(markup, /Compact this thread&#x27;s context \(44% full\)/);
    assert.match(markup, /stroke-dasharray/);
    assert.match(markup, /stroke-dashoffset/);
});
