import { toastManager } from '../components/ui/toast.tsx';

export async function withSavingToast<T>(operation: () => Promise<T>): Promise<T> {
    const toastId = toastManager.add({
        timeout: 0,
        title: 'Saving...',
        type: 'loading',
    });

    try {
        const result = await operation();
        toastManager.close(toastId);
        return result;
    } catch (error) {
        toastManager.close(toastId);
        toastManager.add({
            description: getErrorMessage(error),
            priority: 'high',
            title: 'Save failed',
            type: 'error',
        });
        throw error;
    }
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Try saving again.';
}
