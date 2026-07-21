import { Plus } from '@hugeicons/core-free-icons';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { trpc } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentProfile } from './agent-profile/agent-profile.tsx';
import { createNewAgentName } from './create-agent-name.ts';
import { HumanMemberList } from './human-member-list.tsx';
import { MemberAgentLabel } from './member-agent-label.tsx';

export function MembersPage() {
    const { agentId } = useParams();
    const navigate = useNavigate();
    const utils = trpc.useUtils();
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents ?? [];
    const selectedAgent = agents.find((agent) => agent.id === agentId) ?? null;
    const createAgent = trpc.agent.create.useMutation({
        onSuccess: async ({ agent }) => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.chat.list.invalidate(),
                utils.model.list.invalidate(),
            ]);
            navigate(appRoutes.memberAgent(agent.id));
        },
    });

    return (
        <main className="flex min-h-0 flex-1">
            <aside className="w-72 shrink-0 overflow-y-auto border-[var(--content-card-border)] border-r bg-[var(--sidebar)] pt-[calc(var(--topbar-height)-4px)] pb-6">
                <section>
                    <div className="mb-2 flex items-center justify-between px-3">
                        <h1 className="flex items-center gap-2 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                            <span>Agents</span>
                            <span className="tabular-nums">{agents.length}</span>
                        </h1>
                        <button
                            aria-label="Create agent"
                            className="no-drag flex size-5 cursor-pointer items-center justify-center rounded-md text-sidebar-muted hover:bg-[var(--nav-hover)] hover:text-foreground disabled:cursor-default disabled:opacity-50"
                            disabled={createAgent.isPending}
                            onClick={() => {
                                void withSavingToast(() =>
                                    createAgent.mutateAsync({ name: createNewAgentName(agents) })
                                ).catch(() => undefined);
                            }}
                            title="Create agent"
                            type="button"
                        >
                            <Icon aria-hidden="true" icon={Plus} size={14} />
                        </button>
                    </div>
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
                    ) : agentsQuery.isPending ? null : (
                        <p className="m-auto text-muted-foreground text-sm">Member not found.</p>
                    )
                ) : (
                    <p className="m-auto text-muted-foreground text-sm">Select a member</p>
                )}
            </section>
        </main>
    );
}
