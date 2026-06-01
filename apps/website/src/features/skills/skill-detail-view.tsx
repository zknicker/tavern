import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldDescription, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { useSkillGet } from '../../hooks/skills/use-skill-get.ts';
import { useSkillSecretDelete } from '../../hooks/skills/use-skill-secret-delete.ts';
import { useSkillSecretSave } from '../../hooks/skills/use-skill-secret-save.ts';
import type { SkillGetOutput } from '../../lib/trpc.tsx';
import { SkillDetails } from './skill-install-panel.tsx';

type SkillDetail = NonNullable<SkillGetOutput['skill']>;
const skillsBasePath = '/dashboard/settings/skills';

export function SkillDetailView() {
    const navigate = useNavigate();
    const { skillId: rawSkillId } = useParams<{ skillId?: string }>();
    const skillId = decodeSkillIdParam(rawSkillId);
    const skillQuery = useSkillGet(skillId);
    const skill = skillQuery.data?.skill ?? null;

    const handleBack = React.useCallback(() => {
        navigate(skillsBasePath);
    }, [navigate]);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
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
