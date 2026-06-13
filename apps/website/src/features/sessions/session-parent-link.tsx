import type { SessionRelationshipOutput } from '../../lib/trpc.tsx';
import { getSessionRelationshipName } from './session-relationship.ts';

export function SessionParentLink({ relationship }: { relationship: SessionRelationshipOutput }) {
    const name = getSessionRelationshipName(relationship);

    return (
        <div className="flex w-full items-center gap-2 rounded-md border border-amber-500/15 bg-amber-500/5 px-2.5 py-1 text-left">
            <span className="shrink-0 font-medium text-amber-400/70 text-xs uppercase tracking-wide">
                Parent
            </span>
            <span className="min-w-0 truncate text-foreground/80 text-sm">{name}</span>
            <span className="ml-auto min-w-0 truncate font-mono text-amber-400/40 text-xs">
                {relationship.relatedSession.key}
            </span>
        </div>
    );
}
