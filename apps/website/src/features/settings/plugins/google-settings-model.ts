import type { AgentRuntimeSaveGoogleSettings } from '@tavern/api';
import type { GoogleSettingsOutput } from '../../../lib/trpc.tsx';

type GoogleSettings = NonNullable<GoogleSettingsOutput>;

export interface GoogleSettingsDraft {
    calendarEnabled: boolean;
    enabled: boolean;
}

export function createGoogleDraft(settings: GoogleSettings): GoogleSettingsDraft {
    return {
        calendarEnabled: settings.calendarEnabled,
        enabled: settings.enabled,
    };
}

export function normalizeGoogleDraft(draft: GoogleSettingsDraft) {
    return {
        calendarEnabled: draft.calendarEnabled,
        enabled: draft.enabled,
    };
}

export function hasGoogleDraftChanges(
    settings: GoogleSettings,
    draft: ReturnType<typeof normalizeGoogleDraft>
) {
    return settings.enabled !== draft.enabled || settings.calendarEnabled !== draft.calendarEnabled;
}

export function toGoogleSaveInput(
    _settings: GoogleSettings,
    draft: ReturnType<typeof normalizeGoogleDraft>
): AgentRuntimeSaveGoogleSettings {
    return {
        calendarEnabled: draft.calendarEnabled,
        enabled: draft.enabled,
    };
}
