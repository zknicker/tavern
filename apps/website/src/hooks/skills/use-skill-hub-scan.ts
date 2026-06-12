import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubScan(input: { identifier: string | null }) {
    return trpc.skill.hubScan.useQuery(
        { identifier: input.identifier ?? '' },
        {
            enabled: input.identifier !== null,
            retry: false,
        }
    );
}
