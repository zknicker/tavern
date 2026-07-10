import { toastManager } from '../components/ui/toast.tsx';

/** Success note for settings that agents pick up once per session. */
export const nextSessionNote = "Takes effect on each agent's next session.";

export async function withSavingToast<T>(
    operation: () => Promise<T>,
    options: { successNote?: string } = {}
): Promise<T> {
    const toastId = toastManager.add({
        timeout: 0,
        title: 'Saving…',
        type: 'loading',
    });

    try {
        const result = await operation();
        toastManager.close(toastId);
        if (options.successNote) {
            toastManager.add({
                description: options.successNote,
                title: 'Saved',
                type: 'success',
            });
        }
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

/**
 * Error-only variant for optimistic saves: no loading toast (the UI already
 * reflects the change), just a failure toast when the save does not stick.
 */
export async function withSaveErrorToast<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
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
