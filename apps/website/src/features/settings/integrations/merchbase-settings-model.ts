import type { AgentRuntimeSaveMerchbaseSettings } from '@tavern/api';
import type { MerchbaseSettingsOutput } from '../../../lib/trpc.tsx';

type MerchbaseSettings = NonNullable<MerchbaseSettingsOutput>;

export interface MerchbaseSettingsDraft {
    apiKey: string;
    baseUrl: string;
    clearApiKey: boolean;
    defaultAccount: string;
    defaultMarketplace: string;
    enabled: boolean;
}

export function createDraft(settings: MerchbaseSettings | null): MerchbaseSettingsDraft {
    return {
        apiKey: '',
        baseUrl: settings?.baseUrl ?? '',
        clearApiKey: false,
        defaultAccount: settings?.defaultAccount ?? '',
        defaultMarketplace: settings?.defaultMarketplace ?? '',
        enabled: settings?.enabled ?? false,
    };
}

export function normalizeDraft(draft: MerchbaseSettingsDraft): MerchbaseSettingsDraft {
    return {
        apiKey: draft.apiKey.trim(),
        baseUrl: draft.baseUrl.trim(),
        clearApiKey: draft.clearApiKey,
        defaultAccount: draft.defaultAccount.trim(),
        defaultMarketplace: draft.defaultMarketplace.trim(),
        enabled: draft.enabled,
    };
}

export function toSaveInput(draft: MerchbaseSettingsDraft): AgentRuntimeSaveMerchbaseSettings {
    return {
        apiKey: draft.clearApiKey ? null : draft.apiKey || undefined,
        baseUrl: draft.baseUrl,
        defaultAccount: nullableString(draft.defaultAccount),
        defaultMarketplace: nullableString(draft.defaultMarketplace),
        enabled: draft.enabled,
    };
}

export function hasDraftChanges(settings: MerchbaseSettings, draft: MerchbaseSettingsDraft) {
    return (
        draft.enabled !== settings.enabled ||
        draft.baseUrl !== settings.baseUrl ||
        nullableString(draft.defaultAccount) !== settings.defaultAccount ||
        nullableString(draft.defaultMarketplace) !== settings.defaultMarketplace ||
        draft.clearApiKey ||
        Boolean(draft.apiKey)
    );
}

function nullableString(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
