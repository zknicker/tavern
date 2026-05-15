import type { SessionRelationshipOutput } from '../../lib/trpc.tsx';
import { SessionParentLink } from './session-parent-link.tsx';
import { ToolSummaryCard } from './tools/tool-block.tsx';

interface SessionCardMetadataProps {
    agentName: string;
    duration: string;
    parentRelationship: SessionRelationshipOutput | null;
    showToolSummary?: boolean;
    title: string;
    toolCalls: number;
}

export function SessionCardMetadata({
    agentName,
    duration,
    parentRelationship,
    showToolSummary = true,
    title,
    toolCalls,
}: SessionCardMetadataProps) {
    return (
        <>
            {parentRelationship ? (
                <div className="border-border/60 border-b px-3 py-1.5">
                    <SessionParentLink relationship={parentRelationship} />
                </div>
            ) : null}

            {showToolSummary && toolCalls > 0 ? (
                <div className="border-border/60 border-b px-4 py-2">
                    <ToolSummaryCard
                        agentName={agentName}
                        duration={duration}
                        title={title}
                        toolCalls={toolCalls}
                    />
                </div>
            ) : null}
        </>
    );
}
