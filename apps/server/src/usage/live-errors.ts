import { UsageParseError } from '../storage/provider-usage.ts';

export type UsageErrorCode = 'auth' | 'parse' | 'request' | 'unknown';

export function toUsageErrorState(error: unknown, fallbackMessage: string) {
    if (error instanceof UsageParseError) {
        return {
            code: 'parse' as const,
            message: error.message,
            name: error.name,
        };
    }

    return {
        code: 'unknown' as const,
        message: error instanceof Error ? error.message : fallbackMessage,
        name: error instanceof Error ? error.name : 'UsageStorageError',
    };
}
