import { UserMultipleIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { AgentIdentity } from '../../components/agents/agent-identity.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { SkillGetOutput } from '../../lib/trpc.tsx';

export function SkillDetails({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    return (
        <div className="grid gap-7 text-sm">
            <SidebarSection icon={UserMultipleIcon} title="Agent">
                <AssignedAgentsDetail skill={skill} />
            </SidebarSection>
            {skill.setupCommands.length > 0 ? (
                <SidebarSection title="Setup">
                    <SetupCommandsDetail commands={skill.setupCommands} />
                </SidebarSection>
            ) : skill.install.length > 0 ? (
                <SidebarSection title="Setup">
                    <p className="text-muted-foreground text-sm">
                        {skill.install.map((item) => item.label).join(', ')}
                    </p>
                </SidebarSection>
            ) : null}
            <SidebarSection title="Details">
                <div className="grid gap-3">
                    <DetailRow label="Files">{skill.files.length}</DetailRow>
                    {skill.license ? <DetailRow label="License">{skill.license}</DetailRow> : null}
                </div>
            </SidebarSection>
        </div>
    );
}

function AssignedAgentsDetail({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    return (
        <div>
            {skill.assignedAgents.length > 0 ? (
                <div className="grid gap-2">
                    {skill.assignedAgents.map((agent) => (
                        <AssignedAgentRow agent={agent} key={agent.agentId} />
                    ))}
                </div>
            ) : (
                <div className="grid gap-1">
                    <div className="font-medium text-base text-foreground">Not assigned</div>
                    <p className="text-muted-foreground text-sm">
                        Assign this skill to your agent to check requirements.
                    </p>
                </div>
            )}
        </div>
    );
}

type AssignedAgent = NonNullable<SkillGetOutput['skill']>['assignedAgents'][number];

function AssignedAgentRow({ agent }: { agent: AssignedAgent }) {
    return (
        <div className="grid gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <AgentIdentity
                    avatar={agent.agentAvatar}
                    backgroundColor={agent.agentPrimaryColor}
                    name={agent.agentName}
                    size="sm"
                />
                <Badge size="sm" variant={dependencyBadgeVariant(agent.dependencyState)}>
                    {formatDependencyStateLabel(agent.dependencyState)}
                </Badge>
            </div>
            <CapabilityBadges agent={agent} />
            <p
                className={
                    agent.dependencyState === 'missing'
                        ? 'text-error text-sm'
                        : 'text-muted-foreground text-sm'
                }
            >
                {formatAssignedAgentSummary(agent)}
            </p>
            <RequirementBadges agent={agent} />
        </div>
    );
}

function CapabilityBadges({ agent }: { agent: AssignedAgent }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            <Badge size="sm" variant={booleanBadgeVariant(agent.modelVisible)}>
                Visible: {formatBooleanStatus(agent.modelVisible)}
            </Badge>
            <Badge size="sm" variant={booleanBadgeVariant(agent.commandVisible)}>
                Command: {formatBooleanStatus(agent.commandVisible)}
            </Badge>
        </div>
    );
}

type SetupCommand = NonNullable<SkillGetOutput['skill']>['setupCommands'][number];

function SetupCommandsDetail({ commands }: { commands: SetupCommand[] }) {
    return (
        <div className="grid gap-2">
            {commands.map((command) => (
                <SetupCommandRow command={command} key={command.id} />
            ))}
        </div>
    );
}

function SetupCommandRow({ command }: { command: SetupCommand }) {
    return (
        <div className="grid gap-1.5">
            <div className="text-foreground text-sm">{command.label}</div>
            <CodeSnippet lines={command.command} />
        </div>
    );
}

function RequirementBadges({ agent }: { agent: AssignedAgent }) {
    const requirements = buildRequirementItems(agent);

    if (requirements.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {requirements.map((requirement) => (
                <Badge
                    key={`${requirement.group}:${requirement.value}`}
                    size="sm"
                    variant={requirement.missing ? 'error' : 'secondary'}
                >
                    {requirement.group}: {requirement.value}
                </Badge>
            ))}
        </div>
    );
}

function SidebarSection({
    children,
    icon,
    title,
}: {
    children: React.ReactNode;
    icon?: React.ComponentProps<typeof Icon>['icon'];
    title: string;
}) {
    return (
        <section className="grid gap-3">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground uppercase tracking-[0.08em]">
                {icon ? <Icon className="size-3.5 opacity-70" icon={icon} /> : null}
                {title}
            </div>
            {children}
        </section>
    );
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-0 truncate font-medium text-foreground">{children}</span>
        </div>
    );
}

function formatAssignedAgentSummary(agent: AssignedAgent) {
    if (agent.syncError) {
        return agent.syncError.replace(/\.$/u, '');
    }
    if (agent.dependencyState === 'ready') {
        return agent.modelVisible === false ? 'Requirements met' : 'Visible to model';
    }
    if (agent.dependencyState === 'unknown') {
        return 'Checking agent status';
    }

    return formatMissingRequirements(agent) ?? 'Needs setup';
}

function formatBooleanStatus(value: boolean | null) {
    if (value === null) {
        return 'Unknown';
    }
    return value ? 'Yes' : 'No';
}

function booleanBadgeVariant(value: boolean | null) {
    if (value === null) {
        return 'secondary';
    }
    return value ? 'success' : 'secondary';
}

function formatMissingRequirements(agent: AssignedAgent) {
    const missing = [
        ...agent.missing.bins.map((value) => `bin ${value}`),
        ...agent.missing.anyBins.map((value) => `any bin ${value}`),
        ...agent.missing.env.map((value) => `env ${value}`),
        ...agent.missing.config.map((value) => `config ${value}`),
        ...agent.missing.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}

function dependencyBadgeVariant(state: AssignedAgent['dependencyState']) {
    if (state === 'ready') {
        return 'success';
    }
    if (state === 'missing') {
        return 'error';
    }
    return 'secondary';
}

function formatDependencyStateLabel(state: AssignedAgent['dependencyState']) {
    if (state === 'ready') {
        return 'Ready';
    }
    if (state === 'missing') {
        return 'Needs setup';
    }
    return 'Checking';
}

function buildRequirementItems(agent: AssignedAgent) {
    const groups = [
        ['bin', agent.requirements.bins, agent.missing.bins],
        ['any bin', agent.requirements.anyBins, agent.missing.anyBins],
        ['env', agent.requirements.env, agent.missing.env],
        ['config', agent.requirements.config, agent.missing.config],
        ['os', agent.requirements.os, agent.missing.os],
    ] as const;

    const declared = groups.flatMap(([group, values, missing]) =>
        values.map((value) => ({
            group,
            missing: missing.includes(value),
            value,
        }))
    );
    const configChecks = agent.configChecks.map((check) => ({
        group: 'config',
        missing: !check.satisfied,
        value: check.path,
    }));
    const seen = new Set<string>();

    return [...declared, ...configChecks].filter((item) => {
        const key = `${item.group}:${item.value}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
