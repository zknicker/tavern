import { describe, expect, test } from 'bun:test';
import {
    compileRichResponseSpecStream,
    renderRichResponsePrompt,
    richResponseJsonRenderCatalog,
} from './catalog.ts';

describe('Rich Response json-render catalog', () => {
    test('generates agent prompt from catalog component schemas', () => {
        const prompt = renderRichResponsePrompt();

        expect(prompt).toContain('Available components:');
        expect(prompt).toContain('ComposedChart');
        expect(prompt).toContain('CalendarEvent');
        expect(prompt).toContain('xKey');
        expect(prompt).toContain('barSeries');
        expect(prompt).toContain('lineSeries');
        expect(prompt).toContain('startTime');
        expect(prompt).toContain('endTime');
        expect(prompt).not.toContain('barY');
        expect(prompt).not.toContain('lineY');
        expect(prompt).not.toContain('repeat field');
        expect(prompt).not.toContain('AVAILABLE ACTIONS');
        expect(prompt).not.toContain('STATE WATCHERS');
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

    test('catalog prompt interface stays the agent-facing seam', () => {
        expect(richResponseJsonRenderCatalog.prompt({ mode: 'inline' })).toContain(
            '```spec code fence'
        );
    });
});
