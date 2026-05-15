import * as React from 'react';
import type { DiscordBindingSaveInput } from '../connections/messaging-platform-shared.ts';
import {
    deleteDiscordBinding,
    readDiscordBindings,
    upsertDiscordBinding,
} from './messaging-platform-draft.ts';
import { useOpenClawSettingsDraft } from './provider.tsx';

export function useOpenClawMessagingPlatformDraft() {
    const context = useOpenClawSettingsDraft();
    const bindings = React.useMemo(() => readDiscordBindings(context.config), [context.config]);

    const saveBinding = React.useCallback(
        (input: DiscordBindingSaveInput) => {
            context.updateConfig((config) => upsertDiscordBinding(config, input));
        },
        [context.updateConfig]
    );

    const deleteBinding = React.useCallback(
        (bindingId: string) => {
            context.updateConfig((config) => deleteDiscordBinding(config, bindingId));
        },
        [context.updateConfig]
    );

    return {
        bindings,
        deleteBinding,
        hasConfig: context.config !== null,
        isLoading: context.isLoading,
        isSaving: context.isSaving,
        saveBinding,
    };
}
