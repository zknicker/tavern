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
                    Memory is the llm-wiki hub Cortex can browse. Agent research, ingest, compile,
                    audit, and maintenance work belongs in Tasks.
                </p>
            </div>

            <div>
                <BadgeDivider
                    className="pb-4"
                    subtext="Cortex reads plain Markdown topic wikis. The agent engine owns prompt-time context continuity."
                >
                    Wiki Memory
                </BadgeDivider>
                <CardFrame>
                    <Card className="overflow-hidden p-0">
                        <SettingsRow title="Active topics">
                            <SettingsValue>{status?.topicCount ?? unavailable}</SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Archived topics">
                            <SettingsValue>
                                {status?.archivedTopicCount ?? unavailable}
                            </SettingsValue>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Markdown pages">
                            <SettingsValue>{status?.pageCount ?? unavailable}</SettingsValue>
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
                        <SettingsRow title="Hub path">
                            <CodeSnippet lines={status?.hubPath ?? unavailable} />
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
