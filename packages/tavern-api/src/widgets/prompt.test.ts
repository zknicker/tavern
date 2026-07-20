import { describe, expect, test } from 'bun:test';
import { widgetFenceLabel, widgetNameSchema } from './contracts.ts';
import { renderWidgetsPrompt } from './prompt.ts';

describe('renderWidgetsPrompt', () => {
    test('includes only the requested widgets', () => {
        const prompt = renderWidgetsPrompt(['table', 'bar-chart']);

        expect(prompt).toContain('widget:table —');
        expect(prompt).toContain('widget:bar-chart —');
        expect(prompt).not.toContain('widget:line-chart');
        expect(prompt).not.toContain('widget:merchbase-sales-chart');
    });

    test('renders every catalog widget with a fence example and the shared rules', () => {
        const prompt = renderWidgetsPrompt(widgetNameSchema.options);

        for (const name of widgetNameSchema.options) {
            if (name === 'visual') {
                continue;
            }
            expect(prompt).toContain(`${widgetFenceLabel(name)} —`);
        }
        expect(prompt).toContain('\nartifact — ');
        expect(prompt).toContain('\ndocument — ');
        expect(prompt).not.toContain('widget:artifact');
        expect(prompt).not.toContain('widget:document');
        expect(prompt).toContain('```widget:bar-chart');
        expect(prompt).toContain('Available widgets:');
    });

    test('never renders a catalog entry for the visual fence', () => {
        const prompt = renderWidgetsPrompt(widgetNameSchema.options);

        expect(prompt).not.toContain('widget:visual');
    });

    test('omits the widget list when no widgets are available', () => {
        const prompt = renderWidgetsPrompt([]);

        expect(prompt).not.toContain('Available widgets:');
        expect(prompt).toContain('```widget:bar-chart');
    });

    test('preserves the order it is given', () => {
        const prompt = renderWidgetsPrompt(['calendar-day', 'table']);

        expect(prompt.indexOf('widget:calendar-day —')).toBeLessThan(
            prompt.indexOf('widget:table —')
        );
    });
});
