import * as React from 'react';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { trpc } from '../../../lib/trpc.tsx';
import type { DiscordBindingSaveInput } from './messaging-platform-shared.ts';

export function useMessagingPlatformBindings() {
    const utils = trpc.useUtils();
    const query = trpc.messagingPlatform.list.useQuery();
    const saveMutation = trpc.messagingPlatform.saveBinding.useMutation({
        onSuccess: async () => {
            await utils.messagingPlatform.list.invalidate();
        },
    });
    const deleteMutation = trpc.messagingPlatform.deleteBinding.useMutation({
        onSuccess: async () => {
            await utils.messagingPlatform.list.invalidate();
        },
    });
    const bindings = React.useMemo(() => query.data?.bindings ?? [], [query.data?.bindings]);

    const saveBinding = React.useCallback(
        async (input: DiscordBindingSaveInput) => {
            await withSavingToast(() =>
                saveMutation.mutateAsync({
                    ...input,
                    bindingId: input.id,
                })
            );
        },
        [saveMutation]
    );

    const deleteBinding = React.useCallback(
        async (input: { agentId: string; bindingId: string }) => {
            await withSavingToast(() => deleteMutation.mutateAsync(input));
        },
        [deleteMutation]
    );

    return {
        bindings,
        deleteBinding,
        hasConfig: true,
        isLoading: query.isPending,
        isSaving: saveMutation.isPending || deleteMutation.isPending,
        saveBinding,
    };
}
