import { trpc } from '../../lib/trpc.tsx';

const catalogStaleTimeMs = 5 * 60 * 1000;

export function useSkillHubCatalog(input: { enabled: boolean }) {
    return trpc.skill.hubCatalog.useQuery(undefined, {
        enabled: input.enabled,
        retry: false,
        staleTime: catalogStaleTimeMs,
    });
}
