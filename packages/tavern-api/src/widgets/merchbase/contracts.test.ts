import { describe, expect, test } from 'bun:test';
import { agentRuntimeMerchbaseActionInputSchema } from '../../runtime/contracts.ts';
import { widgetComponentId, widgetRenderInputSchema } from '../contracts.ts';
import { widgetMerchBaseSalesChartPropsSchema } from './contracts.ts';

describe('Widget MerchBase contracts', () => {
    test('defaults sales charts to a 10 day trend range', () => {
        const props = widgetMerchBaseSalesChartPropsSchema.parse({
            title: 'Sales today',
        });

        expect(props.rangeDays).toBe(10);
    });

    test('render input accepts MerchBase sales chart props', () => {
        const props = widgetMerchBaseSalesChartPropsSchema.parse({
            endDate: '2026-06-23',
            rangeDays: 10,
            title: 'MerchBase sales',
        });

        const result = widgetRenderInputSchema.safeParse({
            component: widgetComponentId('merchbase-sales-chart'),
            fallback: { text: props.title },
            props,
            target: 'chat.inline',
        });

        expect(result.success).toBe(true);
    });

    test('agent MerchBase actions stay read-oriented', () => {
        expect(
            agentRuntimeMerchbaseActionInputSchema.parse({
                action: 'sales.summary',
                input: { range: '10d' },
            })
        ).toEqual({
            action: 'sales.summary',
            input: { range: '10d' },
        });

        expect(
            agentRuntimeMerchbaseActionInputSchema.safeParse({
                action: 'sales.sync',
                input: { range: '10d' },
            }).success
        ).toBe(false);
    });
});
