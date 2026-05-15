import { describe, expect, it } from 'bun:test';
import {
    getDataTableCellClassName,
    getDataTableColumnAlignClass,
    getDataTableColumnStyle,
} from './data-table.tsx';

describe('data table helpers', () => {
    it('stretches flex columns while preserving minimum width', () => {
        expect(
            getDataTableColumnStyle({
                columnDef: {
                    meta: {
                        flex: 2,
                    },
                },
                getSize: () => 180,
            })
        ).toEqual({
            flex: 2,
            minWidth: 180,
        });
    });

    it('keeps fixed-width columns from shrinking', () => {
        expect(
            getDataTableColumnStyle({
                columnDef: {},
                getSize: () => 96,
            })
        ).toEqual({
            flexShrink: 0,
            width: 96,
        });
    });

    it('defaults column alignment to the left', () => {
        expect(
            getDataTableColumnAlignClass({
                columnDef: {},
            })
        ).toBe('text-left');
    });

    it('uses right alignment when requested by column meta', () => {
        expect(
            getDataTableColumnAlignClass({
                columnDef: {
                    meta: {
                        align: 'right',
                    },
                },
            })
        ).toBe('text-right');
    });

    it('builds cell classes directly from the current cell metadata', () => {
        expect(
            getDataTableCellClassName({
                column: {
                    columnDef: {
                        meta: {
                            align: 'right',
                            cellClassName: 'tabular-nums',
                        },
                    },
                },
            } as never)
        ).toBe('px-3 text-right tabular-nums');
    });
});
