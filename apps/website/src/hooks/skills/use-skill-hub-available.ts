import { trpc } from '../../lib/trpc.tsx';

const availableStaleTimeMs = 60 * 1000;

export function useSkillHubAvailable(input: { enabled: boolean }) {
    return trpc.skill.hubAvailable.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
        staleTime: availableStaleTimeMs,
    });
}
