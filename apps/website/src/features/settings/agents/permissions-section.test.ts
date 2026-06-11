import assert from 'node:assert/strict';
import test from 'node:test';
import { addAllowlistRule, removeAllowlistRuleAt } from './permissions-section.tsx';

test('addAllowlistRule appends the trimmed rule', () => {
    assert.deepEqual(addAllowlistRule(['ls'], '  git status  '), ['ls', 'git status']);
});

test('addAllowlistRule ignores empty values', () => {
    const list = ['ls'];

    assert.equal(addAllowlistRule(list, '   '), list);
});

test('addAllowlistRule ignores duplicates', () => {
    const list = ['ls', 'git status'];

    assert.equal(addAllowlistRule(list, ' git status '), list);
});

test('removeAllowlistRuleAt drops the rule at the index', () => {
    assert.deepEqual(removeAllowlistRuleAt(['ls', 'git status', 'pwd'], 1), ['ls', 'pwd']);
});
