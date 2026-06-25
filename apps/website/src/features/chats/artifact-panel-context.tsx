import * as React from 'react';
import type { TavernResourceTarget } from './tavern-resource-link.ts';

const ArtifactPanelContext = React.createContext<((target: TavernResourceTarget) => void) | null>(
    null
);

export function ArtifactPanelOpenProvider({
    children,
    onOpen,
}: {
    children: React.ReactNode;
    onOpen: (target: TavernResourceTarget) => void;
}) {
    return <ArtifactPanelContext.Provider value={onOpen}>{children}</ArtifactPanelContext.Provider>;
}

export function useArtifactPanelOpen() {
    return React.useContext(ArtifactPanelContext);
}
