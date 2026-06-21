import { describe, expect, test } from 'bun:test';
import {
    compileRichResponseSpecStream,
    renderRichResponsePrompt,
    richResponseJsonRenderCatalog,
} from './catalog.ts';

describe('Rich Response json-render catalog', () => {
    test('generates agent prompt from catalog component schemas', () => {
        const prompt = renderRichResponsePrompt();

        expect(prompt).toContain('Example output (each line is a separate JSON object):');
        expect(prompt).toContain('AVAILABLE COMPONENTS');
        expect(prompt).toContain('DYNAMIC LISTS (repeat field):');
        expect(prompt).toContain('AVAILABLE ACTIONS:');
        expect(prompt).toContain('STATE WATCHERS:');
        expect(prompt).toContain('ComposedChart');
        expect(prompt).toContain('CalendarEvent');
        expect(prompt).toContain('xKey');
        expect(prompt).toContain('barSeries');
        expect(prompt).toContain('lineSeries');
        expect(prompt).toContain('startTime');
        expect(prompt).toContain('endTime');
        expect(prompt).toContain('{"op":"add","path":"/root","value":"main"}');
        expect(prompt).toContain('"type":"Stack"');
        expect(prompt).toContain('Only Stack accepts children');
        expect(prompt).toContain('If the answer does not need app-rendered UI, or you are unsure');
        expect(prompt).not.toContain('barY');
        expect(prompt).not.toContain('lineY');
    });

    test('compiles json-render spec streams through the Tavern schema', () => {
        const spec = compileRichResponseSpecStream(
            [
                '{"op":"add","path":"/root","value":"chart"}',
                '{"op":"add","path":"/elements/chart","value":{"type":"ComposedChart","props":{"title":"Units and royalties","xKey":"day","data":[{"day":"06-21","units":5,"royalties":20.22}],"barSeries":[{"key":"units","label":"Units"}],"lineSeries":[{"key":"royalties","label":"Royalties"}]},"children":[]}}',
            ].join('\n')
        );

        expect(spec.root).toBe('chart');
        expect(spec.elements.chart?.type).toBe('ComposedChart');
    });

    test('compiles json-render repeat and dynamic props through the Tavern schema', () => {
        const itemTemplate = ['$', '{title}: ', '$', '{units} units'].join('');
        const spec = compileRichResponseSpecStream(
            [
                '{"op":"add","path":"/root","value":"main"}',
                '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["list"]}}',
                '{"op":"add","path":"/elements/list","value":{"type":"Stack","props":{},"repeat":{"statePath":"/items","key":"id"},"children":["item"]}}',
                JSON.stringify({
                    op: 'add',
                    path: '/elements/item',
                    value: {
                        children: [],
                        props: { text: { $template: itemTemplate } },
                        type: 'Text',
                    },
                }),
                '{"op":"add","path":"/state/items","value":[]}',
                '{"op":"add","path":"/state/items/0","value":{"id":"a","title":"Today","units":5}}',
            ].join('\n')
        );

        expect(spec.elements.list?.repeat).toEqual({ key: 'id', statePath: '/items' });
        expect(spec.elements.item?.props).toEqual({
            text: { $template: itemTemplate },
        });
        expect(spec.state.items).toEqual([{ id: 'a', title: 'Today', units: 5 }]);
    });

    test('catalog prompt interface stays the agent-facing seam', () => {
        expect(richResponseJsonRenderCatalog.prompt({ mode: 'inline' })).toContain(
            'DYNAMIC PROPS:'
        );
    });
});
