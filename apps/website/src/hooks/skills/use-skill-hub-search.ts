import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '../../lib/trpc.tsx';

export function useSkillHubSearch(input: { query: string }) {
    const query = input.query.trim();

    return trpc.skill.hubSearch.useQuery(
        { query },
        {
            enabled: query.length > 0,
            placeholderData: keepPreviousData,
            retry: false,
        }
    );
}
