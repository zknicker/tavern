import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { formatChatPaneTargetLink } from '@tavern/api/pane-links';
import * as React from 'react';
import { DiffView } from '../../components/diff/diff-view.tsx';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../components/ui/collapsible.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useWikiPageHistory, useWikiPageRevision } from '../../hooks/wiki/use-wiki-page-history.ts';
import { formatTimestamp } from './utils.ts';

// Per-page history: the commits that touched this page, each expandable into
// that commit's diff. Used by the Wiki inspector and the artifact pane.
export function WikiPageHistoryPanel({ path }: { path: string }) {
    const historyQuery = useWikiPageHistory({ path });

    if (historyQuery.isPending) {
        return <HistoryNote>Loading history...</HistoryNote>;
    }
    const history = historyQuery.data;
    if (historyQuery.error || !history) {
        return <HistoryNote>History is unavailable.</HistoryNote>;
    }
    if (!history.ready) {
        return <HistoryNote>History is unavailable for this Wiki.</HistoryNote>;
    }
    if (history.commits.length === 0) {
        return <HistoryNote>No recorded changes for this page yet.</HistoryNote>;
    }

    return (
        <div className="space-y-1.5">
            {history.commits.map((commit) => (
                <WikiPageHistoryEntry commit={commit} key={commit.hash} path={path} />
            ))}
        </div>
    );
}

function WikiPageHistoryEntry({
    commit,
    path,
}: {
    commit: { committedAt: string; hash: string; subject: string };
    path: string;
}) {
    const [open, setOpen] = React.useState(false);
    const revisionQuery = useWikiPageRevision({ commit: commit.hash, path }, { enabled: open });

    return (
        <Collapsible
            className="rounded-lg border border-border/40 bg-background/60"
            onOpenChange={setOpen}
            open={open}
        >
            <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-hover">
                <Icon
                    className="size-3 shrink-0 -rotate-90 text-muted-foreground/60 transition-transform group-data-[panel-open]:rotate-0"
                    icon={ArrowDown01Icon}
                    strokeWidth={1.7}
                />
                <span className="min-w-0 flex-1 truncate text-foreground text-xs">
                    {formatCommitSubject(commit.subject)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                    {formatTimestamp(commit.committedAt)}
                </span>
            </CollapsibleTrigger>
            <CollapsiblePanel>
                <div className="px-3 pb-3">
                    {revisionQuery.isPending ? (
                        <HistoryNote>Loading diff...</HistoryNote>
                    ) : revisionQuery.data?.ready ? (
                        <SelectionQuoteContainer
                            source={{
                                href: formatChatPaneTargetLink({ kind: 'wikiPage', path }),
                                label: path,
                            }}
                        >
                            <DiffView
                                afterText={revisionQuery.data.afterText}
                                beforeText={revisionQuery.data.beforeText}
                                emptyLabel="No text changes in this commit."
                            />
                        </SelectionQuoteContainer>
                    ) : (
                        <HistoryNote>This revision is unavailable.</HistoryNote>
                    )}
                </div>
            </CollapsiblePanel>
        </Collapsible>
    );
}

function HistoryNote({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground text-xs">{children}</p>;
}

// Runtime commit subjects use an internal "memory:" prefix; the surface
// shows the human part.
function formatCommitSubject(subject: string) {
    const trimmed = subject.replace(/^memory:\s*/u, '').trim();
    return trimmed.length > 0 ? trimmed : 'Change';
}
