import { Download01Icon, UserMultipleIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { AgentIdentity } from '../../components/agents/agent-identity.tsx';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldDescription, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
import { useSkillInstall } from '../../hooks/skills/use-skill-install.ts';
import { formatTimestamp } from '../../lib/format.ts';
import type { SkillGetOutput } from '../../lib/trpc.tsx';

export function InstallSkillDialog({
    onInstalled,
    onOpenChange,
    open,
}: {
    onInstalled: (skillId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent
                className="h-[31rem] max-w-xl"
                closeProps={{ render: <Button size="default" variant="secondary" /> }}
            >
                <DialogHeader>
                    <DialogTitle>Install skill</DialogTitle>
                    <DialogDescription>
                        Install an individual skill from ClawHub or GitHub.
                    </DialogDescription>
                </DialogHeader>
                <InstallSkillForm onInstalled={onInstalled} />
            </DialogContent>
        </Dialog>
    );
}

type SkillInstallSource = 'clawhub' | 'github';
const INSTALL_SKILL_FORM_ID = 'install-skill-form';

function InstallSkillForm({ onInstalled }: { onInstalled: (skillId: string) => void }) {
    const [source, setSource] = React.useState<SkillInstallSource>('clawhub');
    const [clawHubSlug, setClawHubSlug] = React.useState('');
    const [repoSpec, setRepoSpec] = React.useState('');
    const [skillPath, setSkillPath] = React.useState('');
    const install = useSkillInstall();
    const githubInstallSpec = buildInstallSpec({
        repoSpec,
        skillPath,
    });
    const installSpec = source === 'clawhub' ? clawHubSlug.trim() : githubInstallSpec;

    return (
        <>
            <DialogPanel className="grid content-start gap-4">
                <form
                    className="contents"
                    id={INSTALL_SKILL_FORM_ID}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (installSpec) {
                            install.mutate(
                                {
                                    source,
                                    spec: installSpec,
                                },
                                {
                                    onSuccess: (data) => {
                                        if (!data.skill) {
                                            return;
                                        }

                                        setClawHubSlug('');
                                        setRepoSpec('');
                                        setSkillPath('');
                                        onInstalled(data.skill.id);
                                    },
                                }
                            );
                        }
                    }}
                >
                    <Tabs
                        onValueChange={(value) => setSource(value as SkillInstallSource)}
                        value={source}
                    >
                        <TabsList className="grid w-full grid-cols-2 rounded-lg bg-muted/80 p-0.5">
                            <TabsTrigger size="lg" value="clawhub">
                                ClawHub
                            </TabsTrigger>
                            <TabsTrigger size="lg" value="github">
                                GitHub
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {source === 'clawhub' ? (
                        <Field>
                            <FieldLabel htmlFor="skill-clawhub-slug">ClawHub slug</FieldLabel>
                            <Input
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect="off"
                                id="skill-clawhub-slug"
                                name="clawhubSlug"
                                onChange={(event) => setClawHubSlug(event.target.value)}
                                placeholder="code-review"
                                size="lg"
                                spellCheck={false}
                                value={clawHubSlug}
                            />
                            <FieldDescription>
                                Find slugs on ClawHub or with `openclaw skills search`. Use GitHub
                                for owner/repo paths.
                            </FieldDescription>
                        </Field>
                    ) : (
                        <div className="grid gap-3">
                            <Field>
                                <FieldLabel htmlFor="skill-github-repo">Repository</FieldLabel>
                                <Input
                                    autoCapitalize="none"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    id="skill-github-repo"
                                    name="githubRepo"
                                    onChange={(event) => {
                                        const parsed = parsePastedSkillCommand(event.target.value);
                                        if (parsed) {
                                            setRepoSpec(parsed.repoSpec);
                                            setSkillPath(parsed.skillPath);
                                            return;
                                        }

                                        setRepoSpec(event.target.value);
                                    }}
                                    onPaste={(event) => {
                                        const parsed = parsePastedSkillCommand(
                                            event.clipboardData.getData('text')
                                        );
                                        if (!parsed) {
                                            return;
                                        }

                                        event.preventDefault();
                                        setRepoSpec(parsed.repoSpec);
                                        setSkillPath(parsed.skillPath);
                                    }}
                                    placeholder="owner/repo"
                                    size="lg"
                                    spellCheck={false}
                                    value={repoSpec}
                                />
                                <FieldDescription>
                                    Paste an owner/repo path or a skills install command.
                                </FieldDescription>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="skill-github-path">Skill path</FieldLabel>
                                <Input
                                    autoCapitalize="none"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    id="skill-github-path"
                                    name="githubSkillPath"
                                    onChange={(event) => setSkillPath(event.target.value)}
                                    placeholder="skills/private-skill"
                                    size="lg"
                                    spellCheck={false}
                                    value={skillPath}
                                />
                            </Field>
                        </div>
                    )}
                    {install.error ? (
                        <Alert variant="error">
                            <AlertDescription>{install.error.message}</AlertDescription>
                        </Alert>
                    ) : null}
                </form>
            </DialogPanel>
            <DialogFooter>
                <Button
                    disabled={!installSpec}
                    form={INSTALL_SKILL_FORM_ID}
                    loading={install.isPending}
                    size="lg"
                    type="submit"
                >
                    <Icon icon={Download01Icon} />
                    Install
                </Button>
            </DialogFooter>
        </>
    );
}

function buildInstallSpec(input: { repoSpec: string; skillPath: string }) {
    const repoSpec = input.repoSpec.trim();
    const skillPath = input.skillPath.trim().replaceAll(/^\/+|\/+$/g, '');
    if (repoSpec.length === 0) {
        return null;
    }

    if (skillPath.length === 0) {
        return repoSpec;
    }

    return `${normalizeRepoSpec(repoSpec)}/${skillPath}`;
}

function normalizeRepoSpec(value: string) {
    return value
        .trim()
        .replace(/\.git$/, '')
        .replaceAll(/\/+$/g, '');
}

function parsePastedSkillCommand(value: string) {
    const match = /^(?:npx\s+skills\s+add\s+)?(?<repo>\S+)\s+(?:--skill|-s)\s+(?<skill>\S+)$/u.exec(
        value.trim()
    );
    if (!(match?.groups?.repo && match.groups.skill)) {
        return null;
    }

    return {
        repoSpec: normalizeRepoSpec(match.groups.repo),
        skillPath: match.groups.skill.trim(),
    };
}

export function SkillDetails({ skill }: { skill: NonNullable<SkillGetOutput['skill']> }) {
    const updateCheckedAtLabel = useUpdateCheckedAtLabel(skill.updateCheckedAt);

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
                    <DetailRow label="Version">{skill.version ?? 'Unknown'}</DetailRow>
                    {skill.latestVersion ? (
                        <DetailRow label="Latest">{skill.latestVersion}</DetailRow>
                    ) : null}
                    <DetailRow label="Checked">{updateCheckedAtLabel}</DetailRow>
                    {skill.updateAvailable ? (
                        <DetailRow label="Update">
                            <Badge size="sm" variant="warning">
                                Available
                            </Badge>
                        </DetailRow>
                    ) : null}
                    <DetailRow label="Files">{skill.files.length}</DetailRow>
                    {skill.license ? <DetailRow label="License">{skill.license}</DetailRow> : null}
                    {skill.updateError ? (
                        <p className="text-error text-sm">{skill.updateError}</p>
                    ) : null}
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

function formatUpdateCheckedAt(value: string | null, nowMs = Date.now()) {
    if (!value) {
        return 'Never';
    }

    return `${formatRelativeTimeAt(value, nowMs)} · ${formatTimestamp(value)}`;
}

function useUpdateCheckedAtLabel(value: string | null) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 60_000);

        return () => window.clearInterval(interval);
    }, []);

    return React.useMemo(() => formatUpdateCheckedAt(value, now), [value, now]);
}

function formatRelativeTimeAt(value: string, nowMs: number) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const diffMs = nowMs - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

    if (diffMinutes < 2) {
        return 'just now';
    }

    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
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
