import {
    Github01Icon,
    PackageSearchIcon,
    SystemUpdate01Icon,
    Trash2,
} from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '../../components/ui/breadcrumb.tsx';
import { Card } from '../../components/ui/card.tsx';
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
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip.tsx';
import { useSkillCheckUpdates } from '../../hooks/skills/use-skill-check-updates.ts';
import { useSkillDelete } from '../../hooks/skills/use-skill-delete.ts';
import { useSkillGet } from '../../hooks/skills/use-skill-get.ts';
import { useSkillSecretDelete } from '../../hooks/skills/use-skill-secret-delete.ts';
import { useSkillSecretSave } from '../../hooks/skills/use-skill-secret-save.ts';
import type { SkillGetOutput } from '../../lib/trpc.tsx';
import { SkillDetails } from './skill-install-panel.tsx';

type SkillDetail = NonNullable<SkillGetOutput['skill']>;

export function SkillDetailView() {
    const navigate = useNavigate();
    const { skillId: rawSkillId } = useParams<{ skillId?: string }>();
    const skillId = decodeSkillIdParam(rawSkillId);
    const skillQuery = useSkillGet(skillId);
    const skill = skillQuery.data?.skill ?? null;

    const handleBack = React.useCallback(() => {
        navigate('/dashboard/skills');
    }, [navigate]);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <SkillDetailHeader
                onDeleted={() => {
                    navigate('/dashboard/skills', { replace: true });
                }}
                skill={skill}
            />

            {skillQuery.error ? (
                <div className="border-error/40 border-b bg-error-bg px-4 py-3">
                    <p className="text-error-foreground text-sm">{skillQuery.error.message}</p>
                </div>
            ) : null}

            {skillQuery.isPending && !skillQuery.data ? (
                <SkillDetailLoading />
            ) : skill ? (
                <SkillDetailContent skill={skill} />
            ) : (
                <div className="p-4">
                    <MissingSkillCard onBack={handleBack} />
                </div>
            )}
        </div>
    );
}

function SkillDetailHeader({
    onDeleted,
    skill,
}: {
    onDeleted: () => void;
    skill: SkillDetail | null;
}) {
    return (
        <div className="no-drag relative z-40 flex h-[var(--topbar-height)] items-center gap-2 px-4">
            <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap">
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link to="/dashboard/skills" />}>
                            Skills
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                        <BreadcrumbPage>{skill?.name ?? 'Skill'}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            {skill ? <SkillPageActions onDeleted={onDeleted} skill={skill} /> : null}
        </div>
    );
}

function SkillPageActions({ onDeleted, skill }: { onDeleted: () => void; skill: SkillDetail }) {
    const deleteSkill = useSkillDelete();
    const checkUpdates = useSkillCheckUpdates();
    const source = formatSkillSource(skill);
    const sourceUrl = getSkillSourceUrl(skill);
    const sourceIcon = skill.installSource?.source === 'github' ? Github01Icon : PackageSearchIcon;
    const canCheckUpdates = skill.installSource?.source === 'clawhub';

    return (
        <div className="flex shrink-0 items-center gap-2">
            {source ? (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Skill source"
                                onClick={() => {
                                    if (sourceUrl) {
                                        window.open(sourceUrl, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                                size="icon-sm"
                                variant="ghost"
                            />
                        }
                    >
                        <Icon icon={sourceIcon} />
                    </TooltipTrigger>
                    <TooltipContent>{source}</TooltipContent>
                </Tooltip>
            ) : null}
            {canCheckUpdates ? (
                <Button
                    loading={checkUpdates.isPending}
                    onClick={() =>
                        checkUpdates.mutate({
                            skillId: skill.id,
                        })
                    }
                    variant="outline"
                >
                    <Icon icon={SystemUpdate01Icon} />
                    Check For Updates
                </Button>
            ) : null}
            <Button
                loading={deleteSkill.isPending}
                onClick={() =>
                    deleteSkill.mutate(
                        { skillId: skill.id },
                        {
                            onSuccess: () => {
                                onDeleted();
                            },
                        }
                    )
                }
                variant="destructive-outline"
            >
                <Icon icon={Trash2} />
                Uninstall
            </Button>
        </div>
    );
}

function SkillDetailContent({ skill }: { skill: SkillDetail }) {
    const body = skill.bodyMarkdown.trim().length > 0 ? skill.bodyMarkdown : skill.contentMarkdown;

    return (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <ScrollArea className="min-w-0 flex-1" scrollbarGutter>
                <main className="px-5 pt-2 pb-10 md:px-8">
                    <div className="mx-auto max-w-4xl space-y-8">
                        <header>
                            <div className="space-y-1.5">
                                <h1 className="font-semibold text-4xl text-foreground tracking-tight">
                                    {skill.name}
                                </h1>
                                {skill.description ? (
                                    <p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
                                        {skill.description}
                                    </p>
                                ) : null}
                            </div>
                        </header>

                        {skill.secrets.length > 0 ? <SkillSecretsSection skill={skill} /> : null}

                        <SkillSection title="skill.md">
                            {body.trim().length > 0 ? (
                                <pre className="max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border border-border bg-muted/18 p-5 text-foreground text-sm leading-6">
                                    <code>{body}</code>
                                </pre>
                            ) : (
                                <div className="rounded-xl border border-border border-dashed bg-muted/12 px-4 py-3.5 text-muted-foreground text-sm">
                                    This skill does not include instructions.
                                </div>
                            )}
                        </SkillSection>
                    </div>
                </main>
            </ScrollArea>

            <aside className="w-full border-border/70 border-t lg:w-[22rem] lg:border-t-0 lg:border-l">
                <ScrollArea scrollbarGutter>
                    <div className="px-5 py-6">
                        <SkillDetails skill={skill} />
                    </div>
                </ScrollArea>
            </aside>
        </div>
    );
}

function SkillSecretsSection({ skill }: { skill: SkillDetail }) {
    return (
        <SkillSection title="Secrets">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
                {skill.secrets.map((secret, index) => (
                    <SkillSecretRow
                        key={secret.envName}
                        secret={secret}
                        showBorder={index > 0}
                        skillId={skill.id}
                    />
                ))}
            </div>
        </SkillSection>
    );
}

type SkillSecret = SkillDetail['secrets'][number];

function SkillSecretRow({
    secret,
    showBorder,
    skillId,
}: {
    secret: SkillSecret;
    showBorder: boolean;
    skillId: string;
}) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const deleteSecret = useSkillSecretDelete();

    return (
        <div
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                showBorder ? 'border-border border-t' : ''
            }`}
        >
            <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-foreground text-sm">{secret.envName}</div>
                <p className="text-muted-foreground text-xs">
                    {secret.configured
                        ? `Configured${secret.updatedAt ? ` ${formatSecretTimestamp(secret.updatedAt)}` : ''}`
                        : 'Required by this skill'}
                </p>
            </div>
            {secret.configured ? (
                <Button
                    loading={deleteSecret.isPending}
                    onClick={() =>
                        deleteSecret.mutate({
                            envName: secret.envName,
                            skillId,
                        })
                    }
                    size="sm"
                    variant="secondary"
                >
                    Remove
                </Button>
            ) : null}
            <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline">
                {secret.configured ? 'Update' : 'Add'}
            </Button>
            <SkillSecretDialog
                onOpenChange={setDialogOpen}
                open={dialogOpen}
                secret={secret}
                skillId={skillId}
            />
        </div>
    );
}

function SkillSecretDialog({
    onOpenChange,
    open,
    secret,
    skillId,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    secret: SkillSecret;
    skillId: string;
}) {
    const [value, setValue] = React.useState('');
    const saveSecret = useSkillSecretSave();

    React.useEffect(() => {
        if (open) {
            setValue('');
        }
    }, [open]);

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{secret.configured ? 'Update secret' : 'Add secret'}</DialogTitle>
                    <DialogDescription>
                        This value is stored in Tavern Vault and granted only to agents that use
                        this skill.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel>
                    <form
                        className="grid gap-4"
                        id={`skill-secret-${secret.envName}`}
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!value.trim()) {
                                return;
                            }

                            saveSecret.mutate(
                                {
                                    envName: secret.envName,
                                    skillId,
                                    value,
                                },
                                {
                                    onSuccess: () => onOpenChange(false),
                                }
                            );
                        }}
                    >
                        <Field>
                            <FieldLabel htmlFor={`skill-secret-input-${secret.envName}`}>
                                {secret.envName}
                            </FieldLabel>
                            <Input
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect="off"
                                id={`skill-secret-input-${secret.envName}`}
                                onChange={(event) => setValue(event.target.value)}
                                spellCheck={false}
                                type="password"
                                value={value}
                            />
                            <FieldDescription>
                                Secret values are never shown after saving.
                            </FieldDescription>
                        </Field>
                        {saveSecret.error ? (
                            <p className="text-error text-sm">{saveSecret.error.message}</p>
                        ) : null}
                    </form>
                </DialogPanel>
                <DialogFooter>
                    <Button
                        disabled={!value.trim()}
                        form={`skill-secret-${secret.envName}`}
                        loading={saveSecret.isPending}
                        type="submit"
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SkillDetailLoading() {
    return (
        <div className="p-4">
            <Card className="overflow-hidden">
                <div className="px-4 pt-5 pb-4">
                    <div className="h-5 w-40 rounded-md bg-muted" />
                </div>
                <Separator />
                <div className="space-y-3 p-4">
                    <div className="h-8 w-64 rounded-md bg-muted" />
                    <div className="h-24 rounded-xl bg-muted/60" />
                </div>
            </Card>
        </div>
    );
}

function MissingSkillCard({ onBack }: { onBack: () => void }) {
    return (
        <Card className="mx-auto mt-10 max-w-md p-6 text-center">
            <div className="grid gap-2">
                <h2 className="font-semibold text-foreground text-lg">Skill not found</h2>
                <p className="text-muted-foreground text-sm">
                    Refresh the list or go back to skills and choose another skill.
                </p>
            </div>
            <Button className="mt-5" onClick={onBack} variant="secondary">
                Back to skills
            </Button>
        </Card>
    );
}

function SkillSection({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="space-y-2.5">
            <h2 className="font-mono text-caption text-muted-foreground tracking-[0.08em]">
                {title}
            </h2>
            {children}
        </section>
    );
}

function formatSecretTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function decodeSkillIdParam(value: string | undefined) {
    if (!value) {
        return null;
    }

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function formatSkillSource(skill: SkillDetail) {
    if (!skill.installSource) {
        return null;
    }
    if (skill.installSource.source === 'clawhub') {
        return `ClawHub / ${skill.installSource.spec}`;
    }
    return skill.installSource.spec;
}

function getSkillSourceUrl(skill: SkillDetail) {
    if (!skill.installSource || skill.installSource.source !== 'github') {
        return null;
    }

    const spec = skill.installSource.spec
        .trim()
        .replace(/^https?:\/\//u, '')
        .replace(/^github\.com\//u, '')
        .replace(/\.git$/u, '');
    const [owner, repo] = spec.split('/').filter(Boolean);
    return owner && repo ? `https://github.com/${owner}/${repo}` : null;
}
