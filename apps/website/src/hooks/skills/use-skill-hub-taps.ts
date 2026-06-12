import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubTaps(input: { enabled: boolean }) {
    return trpc.skill.hubTaps.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
    });
}

export function useSkillHubTapAdd() {
    const utils = trpc.useUtils();

    return trpc.skill.hubTapAdd.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.hubTaps.invalidate(),
                utils.skill.hubCatalog.invalidate(),
                utils.skill.hubSearch.invalidate(),
            ]);
        },
    });
}

export function useSkillHubTapRemove() {
    const utils = trpc.useUtils();

    return trpc.skill.hubTapRemove.useMutation({
        onSuccess: async () => {
            await Promise.all([
                utils.skill.hubTaps.invalidate(),
                utils.skill.hubCatalog.invalidate(),
                utils.skill.hubSearch.invalidate(),
            ]);
        },
    });
}
