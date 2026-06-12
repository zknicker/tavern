import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubPreview(input: { identifier: string | null }) {
    return trpc.skill.hubPreview.useQuery(
        { identifier: input.identifier ?? '' },
        {
            enabled: input.identifier !== null,
            retry: false,
        }
    );
}
