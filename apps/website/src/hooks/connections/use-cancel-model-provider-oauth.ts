import { trpc } from '../../lib/trpc.tsx';

export function useCancelModelProviderOAuth() {
    return trpc.modelAccess.cancelProviderOAuth.useMutation();
}
