import type * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { SkillGetOutput } from '../../lib/trpc.tsx';

export function SkillDetails({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    return (
        <div className="grid gap-7 text-sm">
            <SidebarSection title="Status">
                <SkillStatusDetail skill={skill} />
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

function SkillStatusDetail({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    return (
        <div className="grid gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="font-medium text-base text-foreground">
                    {formatDependencyStateLabel(skill.dependencyState)}
                </div>
                <Badge size="sm" variant={dependencyBadgeVariant(skill.dependencyState)}>
                    {formatDependencyStateLabel(skill.dependencyState)}
                </Badge>
            </div>
            <p
                className={
                    skill.dependencyState === 'missing'
                        ? 'text-error text-sm'
                        : 'text-muted-foreground text-sm'
                }
            >
                {formatSkillStatusSummary(skill)}
            </p>
            <RequirementBadges skill={skill} />
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

function RequirementBadges({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    const requirements = buildRequirementItems(skill);

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

function formatSkillStatusSummary(skill: NonNullable<SkillGetOutput['skill']>) {
    if (skill.dependencyState === 'ready') {
        return 'Runtime requirements met.';
    }
    if (skill.dependencyState === 'unknown') {
        return 'Runtime status is unknown.';
    }

    return skill.diagnostic ?? formatMissingRequirements(skill.missing) ?? 'Needs setup.';
}

function formatMissingRequirements(requirements: NonNullable<SkillGetOutput['skill']>['missing']) {
    const missing = [
        ...requirements.bins.map((value) => `bin ${value}`),
        ...requirements.anyBins.map((value) => `any bin ${value}`),
        ...requirements.env.map((value) => `env ${value}`),
        ...requirements.config.map((value) => `config ${value}`),
        ...requirements.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}

function dependencyBadgeVariant(state: NonNullable<SkillGetOutput['skill']>['dependencyState']) {
    if (state === 'ready') {
        return 'success';
    }
    if (state === 'missing') {
        return 'error';
    }
    return 'secondary';
}

function formatDependencyStateLabel(
    state: NonNullable<SkillGetOutput['skill']>['dependencyState']
) {
    if (state === 'ready') {
        return 'Ready';
    }
    if (state === 'missing') {
        return 'Needs setup';
    }
    return 'Checking';
}

function buildRequirementItems(skill: NonNullable<SkillGetOutput['skill']>) {
    const groups = [
        ['bin', skill.requirements.bins, skill.missing.bins],
        ['any bin', skill.requirements.anyBins, skill.missing.anyBins],
        ['env', skill.requirements.env, skill.missing.env],
        ['config', skill.requirements.config, skill.missing.config],
        ['os', skill.requirements.os, skill.missing.os],
    ] as const;

    const declared = groups.flatMap(([group, values, missing]) =>
        values.map((value) => ({
            group,
            missing: missing.includes(value),
            value,
        }))
    );
    const seen = new Set<string>();

    return declared.filter((item) => {
        const key = `${item.group}:${item.value}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
