import { afterEach, describe, expect, test, vi } from 'vitest';
import { ocrImageWithOpenAi } from './source-import-openai';

describe('Cortex OpenAI source import processors', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('reads OCR text from nested Responses API output content', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                output: [
                    {
                        content: [
                            {
                                text: 'Nested OCR text',
                                type: 'output_text',
                            },
                        ],
                    },
                ],
            })
        );

        const result = await ocrImageWithOpenAi({
            apiKey: 'sk-test-openai',
            input: {
                kind: 'image',
                mediaType: 'image/png',
                metadata: {},
                modelRef: 'openai/gpt-4o-mini',
                rawBytes: new Uint8Array([1, 2, 3]),
                rawFileName: 'fixture.png',
            },
        });

        expect(result.content).toBe('Nested OCR text');
        expect(result.metadata).toMatchObject({
            model: 'gpt-4o-mini',
            provider: 'openai',
        });
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
