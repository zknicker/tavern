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

test('MentionPicker honors option group labels', () => {
    const option: MentionOption = {
        description: 'openai-codex/gpt-5.5',
        groupLabel: 'Models',
        id: 'model-command:openai-codex/gpt-5.5',
        insertText: '/model openai-codex/gpt-5.5',
        kind: 'command',
        label: 'gpt-5.5',
        projection: 'capability-reference',
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

    assert.match(markup, /Models/);
    assert.doesNotMatch(markup, /Commands/);
});

test('MentionPicker groups agent mentions separately from skills', () => {
    const agentOption: MentionOption = {
        description: 'Agent in this chat',
        id: 'agt_primary',
        insertText: '@Tavern',
        kind: 'agent',
        label: 'Tavern',
        projection: 'agent-reference',
    };
    const skillOption: MentionOption = {
        description: 'Use Tavern chat context, memory, files, and local tools.',
        id: '/skills/tavern/SKILL.md',
        insertText: 'tavern',
        kind: 'skill',
        label: 'Tavern Agent',
        projection: 'skill-context',
    };
    const markup = renderToStaticMarkup(
        <MentionPicker
            activeIndex={0}
            hasQuery
            isPathSearchActive={false}
            isPathSearchLoading={false}
            onSelect={() => undefined}
            options={[agentOption, skillOption]}
        />
    );

    assert.match(markup, /Agents/);
    assert.match(markup, /Skills/);
    assert.ok(markup.indexOf('Agents') < markup.indexOf('Tavern'));
    assert.ok(markup.indexOf('Skills') < markup.indexOf('Tavern Agent'));
});
