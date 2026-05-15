import * as React from 'react';

const DEFAULT_DEBOUNCE_MS = 600;

/**
 * Returns a debounced save function that deduplicates rapid calls.
 * The save fires after `debounceMs` of inactivity. Pending saves are
 * flushed on unmount so no edits are lost.
 */
export function useDebouncedSave<T>(
    save: (value: T) => Promise<void> | void,
    debounceMs = DEFAULT_DEBOUNCE_MS
) {
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestValueRef = React.useRef<T | null>(null);
    const saveRef = React.useRef(save);
    saveRef.current = save;

    const debouncedSave = React.useCallback(
        (value: T) => {
            latestValueRef.current = value;

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = null;
                latestValueRef.current = null;
                void saveRef.current(value);
            }, debounceMs);
        },
        [debounceMs]
    );

    // Flush pending save on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                if (latestValueRef.current !== null) {
                    void saveRef.current(latestValueRef.current);
                }
            }
        };
    }, []);

    return debouncedSave;
}
