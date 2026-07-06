import { describe, expect, test } from 'bun:test';
import { widgetNameSchema } from './contracts.ts';
import { renderWidgetsPrompt } from './prompt.ts';

describe('renderWidgetsPrompt', () => {
    test('includes only the requested widgets', () => {
        const prompt = renderWidgetsPrompt(['table', 'bar-chart']);

        expect(prompt).toContain('widget:table —');
        expect(prompt).toContain('widget:bar-chart —');
        expect(prompt).not.toContain('widget:line-chart');
        expect(prompt).not.toContain('widget:merchbase-sales-chart');
    });

    test('renders every widget with a fence example and the shared rules', () => {
        const prompt = renderWidgetsPrompt(widgetNameSchema.options);

        for (const name of widgetNameSchema.options) {
            expect(prompt).toContain(`widget:${name} —`);
        }
        expect(prompt).toContain('```widget:bar-chart');
        expect(prompt).toContain('Available widgets:');
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
