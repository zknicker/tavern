import * as React from 'react';

type ActiveReplyLayoutSync = () => void;

const ActiveReplyLayoutSyncContext = React.createContext<ActiveReplyLayoutSync | null>(null);

export const ActiveReplyLayoutSyncProvider = ActiveReplyLayoutSyncContext.Provider;

export function useActiveReplyLayoutSync() {
    return React.useContext(ActiveReplyLayoutSyncContext);
}
