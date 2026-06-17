import * as React from 'react';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card, CardContent, CardFrame } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../components/ui/settings-row.tsx';
import { useVaultStatusSuspense } from '../../hooks/vault/use-vault-status.ts';

function MemoryContent() {
    const [status] = useVaultStatusSuspense();
    const unavailable = 'Tavern Runtime unavailable';

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-4 pb-4">
            <div className="max-w-3xl">
                <h1 className="font-semibold text-2xl tracking-tight">Memory</h1>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Vault stores durable Markdown knowledge. Assistant memory is prompt-time
                    execution state.
                </p>
            </div>

            <div>
                <BadgeDivider className="pb-4" subtext="Plain Markdown under the Vault root.">
                    Vault
                </BadgeDivider>
                <CardFrame>
                    <Card className="overflow-hidden p-0">
                        <SettingsRow title="Markdown pages">
                            <SettingsValue>{status?.pageCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="INDEX.md">
                            <SettingsValue>
                                {status?.indexExists ? 'Present' : 'Missing'}
                            </SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Readable">
                            <SettingsValue>{status?.readable ? 'Yes' : 'No'}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Writable">
                            <SettingsValue>{status?.writable ? 'Yes' : 'No'}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Vault path">
                            <CodeSnippet lines={status?.vaultPath ?? unavailable} />
                        </SettingsRow>
                    </Card>
                </CardFrame>
            </div>
        </div>
    );
}

export function Memory() {
    return (
        <React.Suspense fallback={<MemoryLoadingState />}>
            <MemoryContent />
        </React.Suspense>
    );
}

function MemoryLoadingState() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-4 pb-4">
            <div>
                <BadgeDivider className="pb-4" subtext="Loading memory inspection surfaces.">
                    Memory
                </BadgeDivider>
                <Card>
                    <CardContent className="p-4" />
                </Card>
            </div>
        </div>
    );
}
