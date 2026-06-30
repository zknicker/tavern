import { trpc } from '../../lib/trpc.tsx';

export function useToolConfig(input: { toolId: string | null }) {
    return trpc.skill.toolConfig.useQuery(
        { toolId: input.toolId ?? '' },
        {
            enabled: input.toolId !== null,
            retry: false,
        }
    );
}

export function useToolProviderSet() {
    const utils = trpc.useUtils();

    return trpc.skill.setToolProvider.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.skill.toolConfig.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}

export function useToolEnvSave() {
    const utils = trpc.useUtils();

    return trpc.skill.saveToolEnv.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.skill.toolConfig.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}

export function useToolPostSetupRun() {
    const utils = trpc.useUtils();

    return trpc.skill.runToolPostSetup.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.skill.toolConfig.invalidate(), utils.skill.list.invalidate()]);
        },
    });
}
