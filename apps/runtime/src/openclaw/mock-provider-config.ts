export function createMockProviderMap(providerBaseUrl: string) {
    const zeroCost = {
        cacheRead: 0,
        cacheWrite: 0,
        input: 0,
        output: 0,
    };

    return {
        'mock-openai': {
            api: 'openai-responses',
            apiKey: 'test',
            baseUrl: providerBaseUrl,
            models: [
                {
                    api: 'openai-responses',
                    contextWindow: 128_000,
                    cost: zeroCost,
                    id: 'gpt-5.5',
                    input: ['text', 'image'],
                    maxTokens: 4096,
                    name: 'gpt-5.5',
                    reasoning: false,
                },
            ],
            request: {
                allowPrivateNetwork: true,
            },
        },
    };
}
