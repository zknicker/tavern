import { trpc } from '../../lib/trpc.tsx';

/**
 * Prompt evidence for one agent turn: Memory recall matches plus, for dev
 * mode, the raw instructions and prompt the model received. Fetched on demand
 * when the turn drawer opens; null when the Runtime kept no evidence.
 */
export function useChatTurnPrompt(runId: string | null) {
    return trpc.chat.turnPrompt.get.useQuery(
        { runId: runId ?? 'run_none' },
        {
            enabled: Boolean(runId),
            staleTime: 60_000,
        }
    );
}
