import { NavLink, useParams } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { cn } from '../../lib/utils.ts';
import { AgentProfile } from './agent-profile/agent-profile.tsx';
import { HumanMemberList } from './human-member-list.tsx';
import { MemberAgentLabel } from './member-agent-label.tsx';

export function MembersPage() {
    const { agentId } = useParams();
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents ?? [];
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;

    return (
        <main className="flex min-h-0 flex-1">
            <aside className="w-72 shrink-0 overflow-y-auto border-[var(--content-card-border)] border-r bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] pb-6">
                <section>
                    <h1 className="mb-2 flex items-center gap-2 px-3 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                        <span>Agents</span>
                        <span className="tabular-nums">{agents.length}</span>
                    </h1>
                    <div className="space-y-1 px-2">
                        {agents.map((agent) => (
                            <NavLink
                                className={({ isActive }) =>
                                    cn(
                                        'block rounded-lg px-2 py-2 hover:bg-[var(--nav-hover)]',
                                        isActive
                                            ? 'bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)] ring-1 ring-input ring-inset'
                                            : null
                                    )
                                }
                                key={agent.id}
                                to={appRoutes.memberAgent(agent.id)}
                            >
                                <MemberAgentLabel agent={agent} showPresence />
                            </NavLink>
                        ))}
                    </div>
                </section>
                <div className="px-2">
                    <HumanMemberList />
                </div>
            </aside>
            <section className="flex min-w-0 flex-1">
                {agentId ? (
                    selectedAgent ? (
                        <AgentProfile
                            agentId={selectedAgent.id}
                            key={selectedAgent.id}
                            variant="page"
                        />
                    ) : (
                        <p className="m-auto text-muted-foreground text-sm">Member not found.</p>
                    )
                ) : (
                    <p className="m-auto text-muted-foreground text-sm">Select a member</p>
                )}
            </section>
        </main>
    );
}
