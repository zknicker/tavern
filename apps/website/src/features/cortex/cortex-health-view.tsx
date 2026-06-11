import * as React from 'react';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { usePrimaryAgent } from '../../hooks/agents/use-agent-list.ts';
import { useChatDraftLaunch } from '../../hooks/chats/use-chat-draft-launch.ts';
import { runtimeUnhealthyTooltip, useCapability } from '../../hooks/connections/use-capability.ts';
import { formatRelativeTime } from '../../lib/format.ts';
import type { CortexHealthOutput } from '../../lib/trpc.tsx';
import { CortexMarkdownViewer } from './cortex-markdown-viewer.tsx';

type CortexHealthData = NonNullable<CortexHealthOutput>;
type CortexEscalation = CortexHealthData['escalations'][number];

export function CortexHealthView({
    health,
    isLoading,
    onSelectPage,
}: {
    health: CortexHealthOutput | null;
    isLoading: boolean;
    onSelectPage: (page: { path: string; topic: string }) => void;
}) {
    if (!health) {
        return (
            <div className="flex h-full min-h-0 items-center justify-center text-muted-foreground text-sm">
                {isLoading ? 'Checking Cortex health...' : 'Cortex health is unavailable.'}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <article className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
                <div className="w-full">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h1 className="font-semibold text-2xl tracking-tight">Cortex health</h1>
                        <p className="text-muted-foreground text-sm">
                            {formatCount(health.status.topicCount, 'topic')} ·{' '}
                            {formatCount(health.status.pageCount, 'page')} · hub{' '}
                            {health.status.writable ? 'writable' : 'read-only'}
                        </p>
                    </div>

                    {health.runs.length > 0 ? <RunTiles runs={health.runs} /> : null}

                    {health.escalations.length > 0 ? (
                        <section className="mt-8">
                            <BadgeDivider>Needs your call</BadgeDivider>
                            <div className="mt-3 space-y-3">
                                {health.escalations.map((escalation) => (
                                    <EscalationCard
                                        escalation={escalation}
                                        key={`${escalation.topic}:${escalation.path}`}
                                        onSelectPage={onSelectPage}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {health.reports.map((report) => (
                        <section className="mt-8" key={report.topic}>
                            <BadgeDivider
                                subtext={`${report.topic} · ${formatRelativeTime(report.updatedAt)}`}
                            >
                                Librarian report
                            </BadgeDivider>
                            <div className="mt-3">
                                <CortexMarkdownViewer value={report.body} />
                            </div>
                        </section>
                    ))}

                    {health.escalations.length === 0 && health.reports.length === 0 ? (
                        <p className="mt-8 text-muted-foreground text-sm">
                            Nothing needs attention. Reports will appear here after the first
                            librarian run.
                        </p>
                    ) : null}
                </div>
            </article>
        </div>
    );
}

function RunTiles({ runs }: { runs: CortexHealthData['runs'] }) {
    return (
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {runs.map((run) => (
                <div className="rounded-lg bg-muted/40 px-3 py-2.5" key={run.name}>
                    <p className="text-muted-foreground text-sm">{shortRunName(run.name)}</p>
                    <p className="mt-0.5 font-medium text-foreground text-sm">
                        {runStatusLine(run)}
                    </p>
                </div>
            ))}
        </div>
    );
}

function EscalationCard({
    escalation,
    onSelectPage,
}: {
    escalation: CortexEscalation;
    onSelectPage: (page: { path: string; topic: string }) => void;
}) {
    const primaryAgentQuery = usePrimaryAgent();
    const launchChatDraft = useChatDraftLaunch();
    const gatewayCapability = useCapability('gateway');
    const [decision, setDecision] = React.useState('');

    const agent = primaryAgentQuery.data?.agent ?? null;
    const canSend = decision.trim().length > 0 && agent !== null && gatewayCapability.healthy;

    function handleResolve() {
        if (!(agent && canSend)) {
            return;
        }
        launchChatDraft({
            agentId: agent.id,
            content: buildEscalationPrompt(escalation, decision.trim()),
        });
    }

    return (
        <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
            <button
                className="cursor-pointer text-left font-medium text-foreground text-sm hover:underline"
                onClick={() => onSelectPage({ path: escalation.path, topic: escalation.topic })}
                type="button"
            >
                {escalation.title}
            </button>
            {escalation.question ? (
                <p className="mt-1 text-muted-foreground text-sm">{escalation.question}</p>
            ) : null}
            <Textarea
                className="mt-3"
                onChange={(event) => setDecision(event.target.value)}
                placeholder="Your call — the agent applies it to the wiki."
                rows={2}
                value={decision}
            />
            <div className="mt-2 flex justify-end">
                <Button
                    disabled={!canSend}
                    onClick={handleResolve}
                    size="sm"
                    title={gatewayCapability.healthy ? 'Resolve in chat' : runtimeUnhealthyTooltip}
                    type="button"
                >
                    Resolve
                </Button>
            </div>
        </div>
    );
}

function buildEscalationPrompt(escalation: CortexEscalation, decision: string) {
    return [
        `Cortex escalation in the ${escalation.topic} topic wiki (${escalation.path}): ${escalation.title}.`,
        escalation.question ? `Question: ${escalation.question}` : null,
        `My decision: ${decision}`,
        '',
        "Use the wiki skill to apply this: update the affected articles and the inventory record's status, set verified or owner fields as appropriate, and append log.md entries.",
    ]
        .filter((line) => line !== null)
        .join('\n');
}

function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function shortRunName(name: string) {
    return name.replace(/^Tavern: Wiki\s*/u, '').replace(/^\w/u, (c) => c.toUpperCase());
}

function runStatusLine(run: { lastRunAtMs: null | number; lastRunStatus: null | string }) {
    if (!run.lastRunAtMs) {
        return 'Not run yet';
    }
    const when = formatRelativeTime(new Date(run.lastRunAtMs).toISOString());
    if (run.lastRunStatus === 'error') {
        return `Failed ${when}`;
    }
    return `Ran ${when}`;
}
