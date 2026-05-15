import type { SessionHistoryOutput, SessionOutput } from '../../lib/trpc.tsx';

export interface SessionCopyDumpInput {
    limit: number;
    offset: number;
    sessionKey: string;
}

type SessionCopyDump =
    | {
          data: SessionHistoryOutput;
          input: SessionCopyDumpInput;
          procedure: 'session.history.get';
      }
    | {
          data: SessionOutput;
          input: SessionCopyDumpInput;
          procedure: 'session.get';
      };

export function buildSessionCopyDump(dump: SessionCopyDump) {
    return JSON.stringify(dump, null, 2);
}
