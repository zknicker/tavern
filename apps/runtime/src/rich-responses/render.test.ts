import { describe, expect, it } from 'vitest';
import {
    hasRenderableRichResponse,
    parseRichResponseFromAssistantContent,
    parseStreamingRichResponseFromAssistantContent,
    richResponseDisplayContent,
} from './render';

describe('Rich Response rendering', () => {
    it('parses a fenced spec out of assistant content', () => {
        const parsed = parseRichResponseFromAssistantContent(
            [
                'Here is the chart.',
                '',
                '```spec',
                '{"op":"add","path":"/root","value":"title"}',
                '{"op":"add","path":"/elements/title","value":{"type":"Heading","props":{"text":"Sales today"},"children":[]}}',
                '```',
                '',
                'Done.',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the chart.\n\nDone.',
            fallbackText: 'Sales today',
            render: {
                component: 'tavern.rich_response',
                props: {
                    spec: {
                        root: 'title',
                    },
                },
                target: 'chat.inline',
            },
        });
    });

    it('strips invalid Rich Response specs without creating a render payload', () => {
        const parsed = parseRichResponseFromAssistantContent(
            ['Here is the chart.', '', '```spec', 'not json', '```', '', 'Done.'].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the chart.\n\nDone.',
            fallbackText: 'Here is the chart.',
            render: null,
            validationError: 'Rich Response spec line 1 is not valid JSON Patch.',
        });
        expect(hasRenderableRichResponse(parsed)).toBe(false);
    });

    it('hides streaming specs from visible reply text', () => {
        expect(
            richResponseDisplayContent(
                [
                    'Here is the chart.',
                    '',
                    '```spec',
                    '{"op":"add","path":"/root","value":"title"}',
                ].join('\n')
            )
        ).toBe('Here is the chart.');
    });

    it('parses complete lines from an in-flight spec fence', () => {
        const parsed = parseStreamingRichResponseFromAssistantContent(
            [
                'Here is the chart.',
                '',
                '```spec',
                '{"op":"add","path":"/root","value":"title"}',
                '{"op":"add","path":"/elements/title","value":{"type":"Heading","props":{"text":"Sales today"},"children":[]}}',
                '{"op":"add","path":"/elements/body"',
            ].join('\n')
        );

        expect(parsed).toMatchObject({
            displayContent: 'Here is the chart.',
            fallbackText: 'Sales today',
            patches: [{ op: 'add' }, { op: 'add' }],
            render: {
                component: 'tavern.rich_response',
                props: {
                    spec: {
                        root: 'title',
                    },
                },
                target: 'chat.inline',
            },
        });
    });
});
