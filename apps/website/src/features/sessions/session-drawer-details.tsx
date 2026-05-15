import { titleCase } from '../../lib/format.ts';
import type { SessionMetadataOutput } from '../../lib/trpc.tsx';

interface SessionDetailRow {
    label: string;
    value: string;
}

export function buildSessionDetailRows(
    session: Pick<SessionMetadataOutput, 'id' | 'parentSessionKey' | 'platform' | 'source'> & {
        sessionKey: string;
    }
): SessionDetailRow[] {
    const rows: SessionDetailRow[] = [
        {
            label: 'Platform',
            value: session.platform ? titleCase(session.platform) : 'Tavern',
        },
        {
            label: 'Source',
            value: session.source,
        },
        {
            label: 'Session key',
            value: session.sessionKey,
        },
    ];

    rows.push({
        label: 'Session ID',
        value: session.id,
    });

    if (session.parentSessionKey) {
        rows.push({
            label: 'Parent session',
            value: session.parentSessionKey,
        });
    }

    return rows;
}

export function SessionDrawerDetails({
    session,
}: {
    session: Pick<SessionMetadataOutput, 'id' | 'parentSessionKey' | 'platform' | 'source'> & {
        sessionKey: string;
    };
}) {
    const rows = buildSessionDetailRows(session);

    return (
        <div className="border-border/60 border-b bg-muted/20 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
                {rows.map((row) => (
                    <div className="min-w-0" key={row.label}>
                        <p className="font-medium text-caption text-muted-foreground uppercase tracking-[0.14em]">
                            {row.label}
                        </p>
                        <p className="mt-1 break-all font-mono text-meta leading-relaxed">
                            {row.value}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
