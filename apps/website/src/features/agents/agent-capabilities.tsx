import { Add01Icon } from '@hugeicons-pro/core-duotone-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { SkillBadge } from '../skills/skill-badge.tsx';
import { ToolBadge } from '../skills/tool-badge.tsx';
import { AgentSkillDialog } from './agent-skill-dialog.tsx';
import type { AgentToolPolicyView } from './agent-tool-policy.ts';
import { AgentToolsDialog } from './agent-tools-dialog.tsx';

const visibleCapabilityLimit = 6;

export function AgentCapabilities({
    agent,
    enabledSkills,
    skills,
    skillsError,
    skillsPending,
    toolPolicy,
}: {
    agent: AgentListOutput['agents'][number];
    enabledSkills: SkillListOutput['skills'];
    skills: SkillListOutput['skills'];
    skillsError: string | null;
    skillsPending: boolean;
    toolPolicy: AgentToolPolicyView;
}) {
    const [toolDialogOpen, setToolDialogOpen] = React.useState(false);
    const [skillDialogOpen, setSkillDialogOpen] = React.useState(false);
    const visibleTools = toolPolicy.tools.slice(0, visibleCapabilityLimit);
    const toolOverflow = toolPolicy.tools.length - visibleTools.length;
    const visibleSkills = enabledSkills.slice(0, visibleCapabilityLimit);
    const skillOverflow = enabledSkills.length - visibleSkills.length;

    return (
        <section className="flex flex-col gap-2">
            <CapabilityRow
                addLabel="Add tool"
                isEmpty={visibleTools.length === 0}
                onAdd={() => setToolDialogOpen(true)}
                overflowCount={toolOverflow}
                title="Tools"
            >
                {visibleTools.map((tool) =>
                    tool === '*' ? (
                        <span
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card py-1 pr-2.5 pl-2 font-medium text-foreground text-sm shadow-xs"
                            key={tool}
                        >
                            All tools
                        </span>
                    ) : (
                        <ToolBadge key={tool} name={tool} />
                    )
                )}
                {toolPolicy.note ? (
                    <span className="text-muted-foreground text-xs">{toolPolicy.note}</span>
                ) : null}
            </CapabilityRow>
            <CapabilityRow
                addLabel="Add skill"
                isEmpty={visibleSkills.length === 0}
                onAdd={() => setSkillDialogOpen(true)}
                overflowCount={skillOverflow}
                title="Skills"
            >
                {visibleSkills.map((skill) => (
                    <SkillBadge key={skill.id} name={skill.name} />
                ))}
                {skillsPending ? (
                    <span className="text-muted-foreground text-sm">Loading skills...</span>
                ) : null}
            </CapabilityRow>
            {skillsError ? (
                <p className="rounded-md border border-error/20 bg-error/5 px-3 py-2 text-error text-sm">
                    Skills are unavailable: {skillsError}
                </p>
            ) : null}
            <AgentToolsDialog
                agent={agent}
                onOpenChange={setToolDialogOpen}
                open={toolDialogOpen}
                toolPolicy={toolPolicy}
            />
            <AgentSkillDialog
                agent={agent}
                onOpenChange={setSkillDialogOpen}
                open={skillDialogOpen}
                skills={skills}
            />
        </section>
    );
}

function CapabilityRow({
    addLabel,
    children,
    isEmpty,
    onAdd,
    overflowCount,
    title,
}: {
    addLabel: string;
    children: React.ReactNode;
    isEmpty: boolean;
    onAdd: () => void;
    overflowCount: number;
    title: string;
}) {
    return (
        <div className="grid min-h-9 grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-2">
            <h2 className="pt-1.5 font-medium text-muted-foreground text-sm leading-6">{title}</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {children}
                {overflowCount > 0 ? (
                    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 font-medium text-muted-foreground text-sm shadow-xs">
                        +{overflowCount}
                    </span>
                ) : null}
                <button
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isEmpty && '-ml-2'
                    )}
                    onClick={onAdd}
                    type="button"
                >
                    <Icon className="size-3.5" icon={Add01Icon} />
                    {addLabel}
                </button>
            </div>
        </div>
    );
}
