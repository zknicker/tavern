import * as React from 'react';
import { AgentDrawer } from './agent-drawer.tsx';

interface AgentDrawerTarget {
    agentId: string;
    agentName: string;
    chatId: string;
}

const AgentDrawerContext = React.createContext<((target: AgentDrawerTarget) => void) | null>(null);

/**
 * One app-level agent drawer any avatar can open (specs/agent-activity.md):
 * the facepile, transcript avatars, and hover cards all route here instead
 * of owning their own drawer instance.
 */
export function AgentDrawerProvider({ children }: { children: React.ReactNode }) {
    const [target, setTarget] = React.useState<AgentDrawerTarget | null>(null);
    const open = React.useCallback((next: AgentDrawerTarget) => setTarget(next), []);

    return (
        <AgentDrawerContext.Provider value={open}>
            {children}
            <AgentDrawer
                agentId={target?.agentId ?? ''}
                agentName={target?.agentName ?? ''}
                chatId={target?.chatId ?? ''}
                onOpenChange={(openState) => {
                    if (!openState) {
                        setTarget(null);
                    }
                }}
                open={Boolean(target)}
            />
        </AgentDrawerContext.Provider>
    );
}

export function useOpenAgentDrawer() {
    const open = React.useContext(AgentDrawerContext);
    if (!open) {
        throw new Error('useOpenAgentDrawer requires AgentDrawerProvider.');
    }
    return open;
}
