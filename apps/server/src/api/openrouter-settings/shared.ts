import type { OpenRouterSettings } from '../../openrouter/settings.ts';

export function toOpenRouterSettingsOutput(settings: OpenRouterSettings | null) {
    return {
        apiKey: '',
        hasApiKey: Boolean(settings?.hasApiKey),
        hasManagementApiKey: Boolean(settings?.hasManagementApiKey),
        managementApiKey: '',
        updatedAt: settings?.updatedAt ?? null,
    };
}
