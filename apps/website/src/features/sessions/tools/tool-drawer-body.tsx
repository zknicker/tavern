import { DrawerPanel } from '../../../components/ui/drawer.tsx';
import type { SessionToolOutput } from '../../../lib/trpc.tsx';
import { SessionLinkButton } from '../session-link-button.tsx';
import { ToolCallDetailSection } from './tool-call-detail-section.tsx';

interface ToolDrawerBodyProps {
    details: SessionToolOutput | null;
    isPending: boolean;
    queryError: boolean;
}

export function ToolDrawerBody({ details, isPending, queryError }: ToolDrawerBodyProps) {
    return (
        <DrawerPanel className="space-y-5">
            {(details?.actions ?? []).map((action) => (
                <SessionLinkButton
                    key={`${action.kind}:${action.sessionKey}:${action.label}`}
                    label={action.label}
                    sessionKey={action.sessionKey}
                    subtitle={action.subtitle}
                    title={action.title}
                    tone={action.tone}
                />
            ))}
            {isPending ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/10 px-3.5 py-3">
                    <div className="size-1 animate-pulse rounded-full bg-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm">Loading tool details...</p>
                </div>
            ) : null}
            {!isPending && queryError ? (
                <div className="rounded-lg border border-red-500/12 bg-red-500/4 px-3.5 py-3">
                    <p className="text-red-400 text-sm">Unable to load tool details.</p>
                </div>
            ) : null}
            {details ? (
                <>
                    <ToolCallDetailSection title="Arguments" value={details.arguments} />
                    <ToolCallDetailSection title="Result" value={details.result} />
                </>
            ) : null}
        </DrawerPanel>
    );
}
