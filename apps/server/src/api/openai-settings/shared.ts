import type { OpenAiSettings } from '../../openai/settings.ts';

export function toOpenAiSettingsOutput(settings: OpenAiSettings | null) {
    return (
        settings ?? {
            apiKey: '',
            hasApiKey: false,
            updatedAt: null,
        }
    );
}
