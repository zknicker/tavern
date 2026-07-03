import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { useAgentListSuspense } from '../../hooks/agents/use-agent-list.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { WorkspaceBrowserContent } from '../chats/chat-artifact-workspace-content.tsx';

/**
 * The Workspace page. The open file lives in the URL (`?file=`) so it is part of the tab's
 * route — the selection then survives the tab being torn off or merged into another window.
 */
export function Workspace() {
    const [agentList] = useAgentListSuspense();
    const agents = agentList.agents;
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedAgentId = searchParams.get('agent');
    const agent = selectedAgentId
        ? (agents.find((candidate) => candidate.id === selectedAgentId) ?? agents[0] ?? null)
        : (agents[0] ?? null);
    const selectedPath = searchParams.get('file');

    const onSelectAgent = React.useCallback(
        (agentId: string | null) => {
            if (!agentId) {
                return;
            }

            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.set('agent', agentId);
                    next.delete('file');
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const onSelectPath = React.useCallback(
        (path: null | string) => {
            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);

                    if (path) {
                        next.set('file', path);
                    } else {
                        next.delete('file');
                    }

                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    if (!agent) {
        return <MissingAgentState agentId={selectedAgentId ?? 'primary'} />;
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-border/70 border-b px-3">
                <div className="min-w-0 font-medium text-foreground text-sm">Workspace</div>
                <Select onValueChange={onSelectAgent} value={agent.id}>
                    <SelectTrigger aria-label="Agent workspace" className="w-56">
                        <SelectValue>{agent.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end">
                        {agents.map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                                {candidate.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-h-0 flex-1">
                <WorkspaceBrowserContent
                    agentId={agent.id}
                    onSelectPath={onSelectPath}
                    selectedPath={selectedPath}
                    sidebarStorageKey={`tavern.workspace.${agent.id}.sidebar.width`}
                />
            </div>
        </div>
    );
}
