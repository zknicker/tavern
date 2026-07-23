import type { SessionHistoryOutput } from '../../lib/trpc.tsx';
import { ChatTranscript } from '../chats/chat-transcript.tsx';
import { SessionLogHiddenCount } from './session-log-hidden-count.tsx';

export function SessionLog({
    currentSessionKey,
    rows,
    totalRows,
}: {
    currentSessionKey: string;
    rows: SessionHistoryOutput['rows'];
    totalRows: number;
}) {
    const hiddenCount = totalRows - rows.length;

    return (
        <div className="flex flex-col gap-0 py-1">
            <SessionLogHiddenCount hiddenCount={hiddenCount} />
            <ChatTranscript currentSessionKey={currentSessionKey} rows={rows} />
        </div>
    );
}
