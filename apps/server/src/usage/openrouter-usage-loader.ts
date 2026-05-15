import {
    createEmptyOpenRouterActivityOverview,
    type OpenRouterActivityOverview,
} from '../openrouter/activity.ts';
import { getOpenRouterSettings } from '../openrouter/settings.ts';
import { getOpenRouterUsageOverview } from '../storage/provider-usage.ts';
import { toUsageErrorState, type UsageErrorCode } from './live-errors.ts';

export interface LiveUsageOpenRouterState {
    error: {
        code: UsageErrorCode;
        message: string;
        name: string;
    } | null;
    overview: OpenRouterActivityOverview;
    status: 'error' | 'ok';
}

export async function loadOpenRouterActivity(capturedAt: Date): Promise<LiveUsageOpenRouterState> {
    const settings = await getOpenRouterSettings();

    if (!settings?.managementApiKey) {
        return {
            error: null,
            overview: createEmptyOpenRouterActivityOverview(
                'unconfigured',
                'Add an OpenRouter management key on the AI Providers page to load account activity.',
                capturedAt
            ),
            status: 'ok',
        };
    }

    try {
        const overview = await getOpenRouterUsageOverview();

        return {
            error: null,
            overview:
                overview ??
                createEmptyOpenRouterActivityOverview(
                    'empty',
                    'OpenRouter activity sync has not completed yet.',
                    capturedAt
                ),
            status: 'ok',
        };
    } catch (error) {
        const errorState = toUsageErrorState(error, 'OpenRouter activity is unavailable.');

        return {
            error: {
                code: errorState.code,
                message: errorState.message,
                name: errorState.name,
            },
            overview: createEmptyOpenRouterActivityOverview(
                'empty',
                errorState.message,
                capturedAt
            ),
            status: 'error',
        };
    }
}
