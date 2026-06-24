import { describe, expect, test } from 'bun:test';
import { agentRuntimeMerchbaseActionInputSchema } from '../../runtime/contracts.ts';
import { richResponseComponentId, richResponseRenderInputSchema } from '../contracts.ts';
import { richResponseMerchBaseSalesChartPropsSchema } from './contracts.ts';

describe('Rich Response MerchBase contracts', () => {
    test('defaults sales charts to a 10 day trend range', () => {
        const props = richResponseMerchBaseSalesChartPropsSchema.parse({
            title: 'Sales today',
        });

        expect(props.rangeDays).toBe(10);
    });

    test('render input accepts a MerchBase sales chart spec', () => {
        const props = richResponseMerchBaseSalesChartPropsSchema.parse({
            endDate: '2026-06-23',
            rangeDays: 10,
            title: 'MerchBase sales',
        });

        const result = richResponseRenderInputSchema.safeParse({
            component: richResponseComponentId,
            fallback: { text: props.title },
            props: {
                spec: {
                    elements: {
                        chart: { props, type: 'MerchBaseSalesChart' },
                    },
                    root: 'chart',
                    state: {},
                },
            },
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
