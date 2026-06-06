import * as React from 'react';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card, CardContent, CardFrame } from '../../components/ui/card.tsx';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsRow, SettingsValue } from '../../components/ui/settings-row.tsx';
import { useCortexStatusSuspense } from '../../hooks/cortex/use-cortex-status.ts';

function MemoryContent() {
    const [status] = useCortexStatusSuspense();
    const unavailable = 'Tavern Runtime unavailable';

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-4 pb-4">
            <div className="max-w-3xl">
                <h1 className="font-semibold text-2xl tracking-tight">Memory</h1>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Memory is inspectable Cortex state: pages, sources, links, chunks, encodings,
                    recall audit, and repair runs.
                </p>
            </div>

            <div>
                <BadgeDivider
                    className="pb-4"
                    subtext="Durable memory lives in Cortex. OpenClaw context management is prompt-time continuity, not a second memory store."
                >
                    Cortex Memory
                </BadgeDivider>
                <CardFrame>
                    <Card className="overflow-hidden p-0">
                        <SettingsRow title="Pages">
                            <SettingsValue>{status?.pageCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Sources">
                            <SettingsValue>{status?.sourceCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Claims">
                            <SettingsValue>{status?.claimCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Links">
                            <SettingsValue>{status?.linkCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Chunks">
                            <SettingsValue>{status?.chunkCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Encodings">
                            <SettingsValue>
                                {status
                                    ? `${status.encoding.currentCount} current / ${status.encoding.totalCount} total`
                                    : unavailable}
                            </SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Vector database">
                            <SettingsValue>
                                {status
                                    ? `${status.vectorIndex.backend} / ${status.vectorIndex.indexedCount} indexed chunk(s)`
                                    : unavailable}
                            </SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Wiki path">
                            <CodeSnippet lines={status?.wikiPath ?? unavailable} />
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
