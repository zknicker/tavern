import { trpc } from '../../lib/trpc.tsx';

export function useChatStartMessage() {
    return trpc.chat.start.useMutation();
}
