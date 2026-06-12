import { CubeIcon } from '@hugeicons-pro/core-stroke-rounded';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { useSkillEnabledSet } from '../../hooks/skills/use-skill-enabled-set.ts';
import { useSkillHubInstall } from '../../hooks/skills/use-skill-hub-install.ts';
import { useSkillHubPreview } from '../../hooks/skills/use-skill-hub-preview.ts';
import { useSkillHubScan } from '../../hooks/skills/use-skill-hub-scan.ts';
import { useSkillHubUninstall } from '../../hooks/skills/use-skill-hub-uninstall.ts';
import { CortexMarkdownViewer } from '../cortex/cortex-markdown-viewer.tsx';
import { SkillScanBadge, SkillTrustBadge } from './skill-hub-badges.tsx';
import { formatSkillName } from './skill-name-format.ts';

/**
 * One skill, installed or available. Installed skills carry the inventory id
 * (for the enable toggle) and, when the hub lockfile knows them, the
 * identifier and lockfile name that make them uninstallable. Available skills
 * carry the hub identifier that makes them installable.
 */
export interface SkillDialogSubject {
    description: null | string;
    enabled?: boolean;
    identifier: null | string;
    installed: boolean;
    name: string;
    skillId: null | string;
    trustLevel?: 'builtin' | 'community' | 'trusted';
    uninstallName: null | string;
}

export function SkillDialog({
    onOpenChange,
    subject,
}: {
    onOpenChange: (open: boolean) => void;
    subject: null | SkillDialogSubject;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={subject !== null}>
            <DialogContent className="sm:max-w-2xl">
                {subject ? (
                    <SkillDialogBody onClose={() => onOpenChange(false)} subject={subject} />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function SkillDialogBody({
    onClose,
    subject,
}: {
    onClose: () => void;
    subject: SkillDialogSubject;
}) {
    const setEnabled = useSkillEnabledSet();
    const install = useSkillHubInstall();
    const uninstall = useSkillHubUninstall();
    const scanQuery = useSkillHubScan({
        identifier: subject.installed ? null : subject.identifier,
    });
    const scanBlocked = scanQuery.data?.policy === 'block';
    const mutationError = install.error ?? uninstall.error ?? setEnabled.error;

    return (
        <>
            <DialogHeader className="gap-3">
                <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground">
                    <Icon className="size-6" icon={CubeIcon} />
                </div>
                <div className="flex items-center gap-3">
                    <DialogTitle className="flex items-baseline gap-2">
                        {formatSkillName(subject.name)}
                        <span className="font-normal text-muted-foreground">Skill</span>
                    </DialogTitle>
                    <span className="ml-auto flex items-center gap-2">
                        {subject.trustLevel ? (
                            <SkillTrustBadge trustLevel={subject.trustLevel} />
                        ) : null}
                        {subject.installed && subject.skillId ? (
                            <Switch
                                aria-label={`${subject.enabled ? 'Disable' : 'Enable'} ${subject.name}`}
                                checked={subject.enabled === true}
                                disabled={setEnabled.isPending}
                                onCheckedChange={(checked) => {
                                    if (subject.skillId) {
                                        setEnabled.mutate({
                                            enabled: checked,
                                            skillId: subject.skillId,
                                        });
                                    }
                                }}
                            />
                        ) : null}
                    </span>
                </div>
                {subject.description ? (
                    <p className="text-foreground/80 text-sm leading-6">{subject.description}</p>
                ) : null}
            </DialogHeader>

            <DialogPanel className="grid gap-4">
                {subject.installed || !scanQuery.data ? null : (
                    <div className="flex flex-wrap items-center gap-2">
                        <SkillScanBadge scan={scanQuery.data} />
                        {scanQuery.data.findings.slice(0, 4).map((finding) => (
                            <span
                                className="text-muted-foreground text-xs"
                                key={`${finding.file}:${finding.line}:${finding.description}`}
                            >
                                <span className="font-mono uppercase">{finding.severity}</span>{' '}
                                {finding.description}
                            </span>
                        ))}
                    </div>
                )}

                <SkillMarkdownCard identifier={subject.identifier} />

                {mutationError ? (
                    <p className="text-error text-sm">{mutationError.message}</p>
                ) : null}

                <div className="flex items-center gap-2">
                    {subject.installed && subject.uninstallName ? (
                        <Button
                            className="bg-destructive/8 text-destructive-foreground hover:bg-destructive/16"
                            disabled={uninstall.isPending}
                            onClick={() => {
                                if (subject.uninstallName) {
                                    uninstall.mutate(
                                        { name: subject.uninstallName },
                                        { onSuccess: onClose }
                                    );
                                }
                            }}
                            variant="ghost"
                        >
                            {uninstall.isPending ? <Spinner className="size-4" /> : null}
                            {uninstall.isPending ? 'Uninstalling…' : 'Uninstall'}
                        </Button>
                    ) : null}
                    {subject.installed || !subject.identifier ? null : (
                        <Button
                            className="ml-auto"
                            disabled={install.isPending || scanBlocked}
                            onClick={() => {
                                if (subject.identifier) {
                                    install.mutate(
                                        { identifier: subject.identifier },
                                        { onSuccess: onClose }
                                    );
                                }
                            }}
                            title={
                                scanBlocked ? 'The security scan blocked this skill.' : undefined
                            }
                        >
                            {install.isPending ? <Spinner className="size-4" /> : null}
                            {install.isPending ? 'Installing…' : 'Install skill'}
                        </Button>
                    )}
                </div>
            </DialogPanel>
        </>
    );
}

function SkillMarkdownCard({ identifier }: { identifier: null | string }) {
    const previewQuery = useSkillHubPreview({ identifier });

    if (identifier === null) {
        return (
            <p className="text-muted-foreground text-sm">
                This skill's instructions are managed by the runtime and have no source preview.
            </p>
        );
    }
    if (previewQuery.isPending) {
        return (
            <div className="grid min-h-32 place-items-center rounded-xl border border-border/70 bg-muted/20">
                <Spinner className="size-5" />
            </div>
        );
    }
    if (previewQuery.error) {
        return <p className="text-error text-sm">{previewQuery.error.message}</p>;
    }

    const body = stripFrontmatter(previewQuery.data?.skillMd ?? '');
    return (
        <div className="max-h-80 overflow-auto rounded-xl border border-border/70 bg-muted/20 px-5 py-4">
            {body.trim().length > 0 ? (
                <CortexMarkdownViewer value={body} />
            ) : (
                <p className="text-muted-foreground text-sm">This skill has no SKILL.md content.</p>
            )}
        </div>
    );
}

function stripFrontmatter(skillMd: string) {
    return skillMd.replace(/^---\n[\s\S]*?\n---\n?/u, '');
}
