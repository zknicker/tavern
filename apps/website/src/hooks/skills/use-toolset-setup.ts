import { trpc } from '../../lib/trpc.tsx';

export function useToolsetConfig(input: { toolsetId: string | null }) {
    return trpc.skill.toolsetConfig.useQuery(
        { toolsetId: input.toolsetId ?? '' },
        {
            enabled: input.toolsetId !== null,
            retry: false,
        }
    );
}

export function useToolsetProviderSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setToolsetProvider.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.toolsetConfig.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}

export function useToolsetEnvSave() {
    const utils = trpc.useUtils();

    return trpc.skill.saveToolsetEnv.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.toolsetConfig.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}

export function useToolsetPostSetupRun() {
    const utils = trpc.useUtils();

    return trpc.skill.runToolsetPostSetup.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.toolsetConfig.invalidate(),
                utils.skill.list.invalidate(),
            ]);
        },
    });
}
