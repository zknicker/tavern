import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useAgentInbox } from '../../../hooks/agents/use-agent-inbox.ts';

// Read-only inbox visibility (I4): pending targets, muted channels, and
// followed threads. Attention is agent-owned — humans steer it by asking in
// chat, so nothing here mutates. Dev builds also show per-target cursors.
export function AgentInboxSection({ agentId }: { agentId: string }) {
    const inbox = useAgentInbox(agentId).data;
    if (!inbox) {
        return null;
    }
    const empty =
        inbox.rows.length === 0 && inbox.muted.length === 0 && inbox.followedThreads.length === 0;

    return (
        <SettingsSection title="Inbox">
            <SettingsGroup>
                {empty ? (
                    <SettingsRow title="Nothing pending">
                        <span className="text-muted-foreground text-sm">
                            All caught up — no unread targets.
                        </span>
                    </SettingsRow>
                ) : null}
                {inbox.rows.map((row) => (
                    <SettingsRow key={row.target} title={row.target}>
                        <span className="text-muted-foreground text-sm">
                            {row.pendingCount} pending
                            {row.mentioned ? ' · mentioned' : ''}
                            {row.thread ? ' · thread' : ''}
                            {row.dm ? ' · dm' : ''}
                            {` · latest @${row.latestSender}`}
                        </span>
                    </SettingsRow>
                ))}
                {inbox.muted.length > 0 ? (
                    <SettingsRow title="Muted">
                        <span className="text-muted-foreground text-sm">
                            {inbox.muted.join(', ')}
                        </span>
                    </SettingsRow>
                ) : null}
                {inbox.followedThreads.length > 0 ? (
                    <SettingsRow title="Following">
                        <span className="text-muted-foreground text-sm">
                            {inbox.followedThreads.join(', ')}
                        </span>
                    </SettingsRow>
                ) : null}
                {import.meta.env.DEV && inbox.cursors.length > 0 ? (
                    <SettingsRow title="Cursors (dev)">
                        <span className="text-muted-foreground text-sm">
                            {inbox.cursors
                                .map(
                                    (cursor) =>
                                        `${cursor.target} delivered=${cursor.delivered} seen=${cursor.seen}`
                                )
                                .join(' · ')}
                        </span>
                    </SettingsRow>
                ) : null}
            </SettingsGroup>
        </SettingsSection>
    );
}
