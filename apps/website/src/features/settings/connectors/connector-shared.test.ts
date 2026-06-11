import assert from 'node:assert/strict';
import test from 'node:test';
import { joinArgs, splitArgs, toSecretFieldInputs } from './connector-shared.ts';

test('splitArgs splits on whitespace and drops empty parts', () => {
    assert.deepEqual(splitArgs('  serve  --port 8080 '), ['serve', '--port', '8080']);
});

test('splitArgs returns an empty list for blank input', () => {
    assert.deepEqual(splitArgs('   '), []);
});

test('joinArgs joins args with single spaces', () => {
    assert.equal(joinArgs(['serve', '--port', '8080']), 'serve --port 8080');
});

test('toSecretFieldInputs trims names and drops empty names', () => {
    assert.deepEqual(
        toSecretFieldInputs(
            [
                { name: '  TOKEN  ', value: 'abc' },
                { name: '   ', value: 'ignored' },
            ],
            []
        ),
        [{ name: 'TOKEN', value: 'abc' }]
    );
});

test('toSecretFieldInputs omits the value when blank and the name is saved', () => {
    assert.deepEqual(
        toSecretFieldInputs(
            [
                { name: 'TOKEN', value: '' },
                { name: 'REGION', value: 'us-east-1' },
            ],
            [{ hasValue: true, name: 'TOKEN' }]
        ),
        [{ name: 'TOKEN' }, { name: 'REGION', value: 'us-east-1' }]
    );
});

test('toSecretFieldInputs includes a blank value for unsaved names', () => {
    assert.deepEqual(toSecretFieldInputs([{ name: 'NEW', value: '' }], []), [
        { name: 'NEW', value: '' },
    ]);
});
