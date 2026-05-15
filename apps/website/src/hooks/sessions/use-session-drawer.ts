import type { PropsWithChildren } from 'react';
import * as React from 'react';

interface SessionDrawerContextValue {
    closeSession: () => void;
    isOpen: boolean;
    openSession: (sessionKey: string) => void;
    sessionKey: string | null;
}

const SessionDrawerContext = React.createContext<SessionDrawerContextValue | null>(null);

export function SessionDrawerProvider({ children }: PropsWithChildren) {
    const [sessionKey, setSessionKey] = React.useState<string | null>(null);

    const value = React.useMemo<SessionDrawerContextValue>(
        () => ({
            closeSession() {
                setSessionKey(null);
            },
            isOpen: sessionKey !== null,
            openSession(nextSessionKey: string) {
                setSessionKey(nextSessionKey);
            },
            sessionKey,
        }),
        [sessionKey]
    );

    return React.createElement(SessionDrawerContext.Provider, { value }, children);
}

export function useSessionDrawer() {
    const context = React.useContext(SessionDrawerContext);

    if (context === null) {
        throw new Error('useSessionDrawer must be used within a SessionDrawerProvider.');
    }

    return context;
}
