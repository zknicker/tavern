import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillHubInstall } from '../../hooks/skills/use-skill-hub-install.ts';
import { useSkillHubPreview } from '../../hooks/skills/use-skill-hub-preview.ts';
import { useSkillHubScan } from '../../hooks/skills/use-skill-hub-scan.ts';
import { useSkillHubUninstall } from '../../hooks/skills/use-skill-hub-uninstall.ts';
import type { SkillHubAvailableOutput, SkillHubItemOutput } from '../../lib/trpc.tsx';
import { formatSkillSourceLabel, SkillScanBadge, SkillTrustBadge } from './skill-hub-badges.tsx';

export function SkillHubPreview({
    installed,
    item,
}: {
    installed: SkillHubAvailableOutput['installed'];
    item: SkillHubItemOutput;
}) {
    const previewQuery = useSkillHubPreview({ identifier: item.identifier });
    const scanQuery = useSkillHubScan({ identifier: item.identifier });
    const install = useSkillHubInstall();
    const uninstall = useSkillHubUninstall();
    const installedEntry = installed[item.identifier];
    const installedName = installedEntry?.name ?? item.name;
    const scanBlocked = scanQuery.data?.policy === 'block';
    const mutationError = install.error ?? uninstall.error;

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-base text-foreground">{item.name}</h3>
                <SkillTrustBadge trustLevel={item.trustLevel} />
                <Badge size="sm" variant="secondary">
                    {formatSkillSourceLabel(item.source)}
                </Badge>
                {scanQuery.data ? <SkillScanBadge scan={scanQuery.data} /> : null}
                {scanQuery.isPending ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Spinner className="size-3" /> Scanning…
                    </span>
                ) : null}
            </div>

            {item.description ? (
                <p className="text-muted-foreground text-sm">{item.description}</p>
            ) : null}

            {scanQuery.data && scanQuery.data.findings.length > 0 ? (
                <div className="grid gap-1 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                    <p className="font-medium text-foreground text-sm">Scan findings</p>
                    {scanQuery.data.findings.slice(0, 6).map((finding) => (
                        <p
                            className="text-muted-foreground text-sm"
                            key={`${finding.file}:${finding.line}:${finding.description}`}
                        >
                            <span className="font-mono text-xs uppercase">{finding.severity}</span>{' '}
                            {finding.description}
                            {finding.file ? (
                                <span className="text-xs"> ({finding.file})</span>
                            ) : null}
                        </p>
                    ))}
                    {scanQuery.data.policyReason ? (
                        <p className="text-muted-foreground text-xs">
                            {scanQuery.data.policyReason}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {previewQuery.isPending ? (
                <div className="grid min-h-32 place-items-center">
                    <Spinner className="size-5" />
                </div>
            ) : null}
            {previewQuery.error ? (
                <p className="text-error text-sm">{previewQuery.error.message}</p>
            ) : null}
            {previewQuery.data ? (
                <div className="grid gap-3">
                    {previewQuery.data.files.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">Will install:</span>
                            {previewQuery.data.files.map((file) => (
                                <Badge key={file} size="sm" variant="subtle">
                                    {file}
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 px-4 py-3 font-mono text-foreground/90 text-xs leading-5">
                        {previewQuery.data.skillMd || 'This skill has no SKILL.md content.'}
                    </pre>
                </div>
            ) : null}

            {mutationError ? <p className="text-error text-sm">{mutationError.message}</p> : null}

            <div className="flex items-center justify-end gap-2">
                {installedEntry ? (
                    <Button
                        disabled={uninstall.isPending}
                        onClick={() => uninstall.mutate({ name: installedName })}
                        variant="outline"
                    >
                        {uninstall.isPending ? <Spinner className="size-4" /> : null}
                        {uninstall.isPending ? 'Removing…' : 'Remove'}
                    </Button>
                ) : (
                    <Button
                        disabled={install.isPending || scanBlocked}
                        onClick={() => install.mutate({ identifier: item.identifier })}
                        title={scanBlocked ? 'The security scan blocked this skill.' : undefined}
                    >
                        {install.isPending ? <Spinner className="size-4" /> : null}
                        {install.isPending ? 'Installing…' : 'Install skill'}
                    </Button>
                )}
            </div>
        </div>
    );
}
