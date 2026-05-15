import * as React from 'react';
import type { AlertVariant } from '../components/ui/alert.tsx';

const TOAST_DURATION_MS = 2400;

interface SaveToastState {
    message: string;
    variant: AlertVariant;
}

export function useSaveToast() {
    const [toast, setToast] = React.useState<SaveToastState | null>(null);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = React.useCallback((variant: AlertVariant, message: string) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setToast({ message, variant });
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setToast(null);
        }, TOAST_DURATION_MS);
    }, []);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        showErrorToast: React.useCallback(
            (message: string) => {
                showToast('error', message);
            },
            [showToast]
        ),
        showSuccessToast: React.useCallback(
            (message: string) => {
                showToast('success', message);
            },
            [showToast]
        ),
        toast,
    };
}
