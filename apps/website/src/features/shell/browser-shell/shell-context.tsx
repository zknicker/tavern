import { createContext, use } from 'react';
import type { TabsContextValue } from './types.ts';

export const ShellContext = createContext<TabsContextValue | null>(null);

/** Access the browser-shell contract. Must be rendered inside a shell provider. */
export function useShell(): TabsContextValue {
    const ctx = use(ShellContext);

    if (!ctx) {
        throw new Error('useShell must be used within a browser-shell provider');
    }

    return ctx;
}
