import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useAgentPresence } from '../../hooks/agents/use-agent-presence.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { resolveDmPresenceLabel } from '../chats/agent-presence.tsx';

const maximumVisibleAgents = 3;
const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

export function SidebarAgentActivityStrip() {
    const navigate = useNavigate();
    const { chatId: currentChatId } = useParams<{ chatId: string }>();
    const dark = useResolvedThemeOptional() === 'dark';
    const agents = useAgentList().data?.agents ?? [];
    const presence = useAgentPresence().data?.presence ?? [];
    const busyAgents = presence.filter((entry) => entry.state === 'busy');
    const agentById = React.useMemo(
        () => new Map(agents.map((agent) => [agent.id, agent])),
        [agents]
    );

    if (busyAgents.length === 0) {
        return null;
    }

    const hiddenAgentCount = Math.max(0, busyAgents.length - maximumVisibleAgents);

    return (
        <div className="-mx-2 border-sidebar-border border-t px-2 pt-2">
            <div className="flex flex-col gap-0.5">
                {busyAgents.slice(0, maximumVisibleAgents).map((entry) => {
                    const agent = agentById.get(entry.agentId);
                    const label = resolveDmPresenceLabel(entry, currentChatId ?? '');

                    return (
                        <button
                            className={cn(
                                'flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-left',
                                entry.chatId
                                    ? 'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
                                    : 'cursor-default'
                            )}
                            disabled={!entry.chatId}
                            key={entry.agentId}
                            onClick={() => {
                                if (entry.chatId) {
                                    void navigate(appRoutes.chat(entry.chatId));
                                }
                            }}
                            type="button"
                        >
                            <span className="flex size-5 shrink-0 items-center justify-center overflow-visible">
                                <AgentFace
                                    animate={false}
                                    dark={dark}
                                    head={agent?.effectiveCharacter ?? 'none'}
                                    ink={resolveAgentInk(dark, agent?.effectivePrimaryColor)}
                                    size={20}
                                    style={faceStyle}
                                />
                            </span>
                            <span
                                aria-hidden="true"
                                className="size-2 shrink-0 animate-pulse rounded-full bg-warning"
                            />
                            <span className="min-w-0 truncate text-muted-foreground text-xs">
                                {label}
                            </span>
                        </button>
                    );
                })}
                {hiddenAgentCount > 0 ? (
                    <span className="px-2 text-muted-foreground text-xs">
                        +{hiddenAgentCount} more
                    </span>
                ) : null}
            </div>
        </div>
    );
}
