import { describe, expect, test } from 'bun:test';
import { richResponseTablePropsSchema } from './contracts.ts';

describe('Rich Response contracts', () => {
    test('table props accept matrix shorthand and normalize to keyed rows', () => {
        const props = richResponseTablePropsSchema.parse({
            columns: ['State', 'Population'],
            rows: [
                ['California', '39,538,223'],
                ['Texas', '29,145,505'],
            ],
        });

        expect(props).toEqual({
            columns: [
                { key: 'col_1', label: 'State' },
                { key: 'col_2', label: 'Population' },
            ],
            rows: [
                { col_1: 'California', col_2: '39,538,223' },
                { col_1: 'Texas', col_2: '29,145,505' },
            ],
        });
    });

    test('table matrix shorthand fills missing cells with null', () => {
        const props = richResponseTablePropsSchema.parse({
            columns: ['State', 'Population'],
            rows: [['California']],
        });

        expect(props.rows).toEqual([{ col_1: 'California', col_2: null }]);
    });
});
