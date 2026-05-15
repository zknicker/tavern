import { trpc } from '../../lib/trpc.tsx';

export function useOpenClawConfigApply() {
    return trpc.openClawConfig.save.useMutation();
}
