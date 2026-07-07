import { formatLocalIsoWithOffset } from '../timezone.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { readCurrentAgentSession } from './agent-session-store.ts';
import { createAgentParticipantId } from './chat-api/ids.ts';

/**
 * Session freshness policy for agent seats, following the personal-agent
 * gateway convention (Hermes, OpenClaw): rotate at a fixed early-morning hour
 * in the home timezone, or after a long idle gap, whichever comes first.
 * Evaluated lazily when a turn is about to start; rotation snapshots the
 * prompt-context cursor so the fresh session never replays old history.
 */

const dailyResetHour = 4;
const idleResetMs = 24 * 60 * 60 * 1000;

export type SessionRotationReason = 'daily' | 'idle';

export function ensureFreshAgentSession(input: {
    agentId: string;
    chatId: string;
    now?: Date;
}): SessionRotationReason | null {
    const now = input.now ?? new Date();
    const session = readCurrentAgentSession({
        agentParticipantId: createAgentParticipantId(input.agentId),
        chatId: input.chatId,
    });
    if (!session || session.status !== 'active') {
        return null;
    }
    // A session that has never run a turn is fresh by construction.
    if (!session.runtimeSessionId) {
        return null;
    }

    const reason = staleReason(new Date(session.updatedAt), now);
    if (!reason) {
        return null;
    }

    resetAgentSession({
        agentId: input.agentId,
        chatId: input.chatId,
        noticeText:
            reason === 'daily'
                ? 'Started a fresh session on the daily schedule. New messages start with fresh context.'
                : 'Started a fresh session after a day of inactivity. New messages start with fresh context.',
    });
    return reason;
}

function staleReason(lastActive: Date, now: Date): SessionRotationReason | null {
    if (now.getTime() - lastActive.getTime() >= idleResetMs) {
        return 'idle';
    }
    if (lastActive.getTime() < lastDailyBoundary(now).getTime()) {
        return 'daily';
    }
    return null;
}

/**
 * The most recent occurrence of the reset hour in the home timezone. Derived
 * from the local time-of-day rather than constructed local dates, so it stays
 * correct across offsets; a DST transition can shift one boundary by an hour,
 * which is acceptable for session hygiene.
 */
export function lastDailyBoundary(now: Date, timezone = resolveHomeTimezone()): Date {
    const localIso = formatLocalIsoWithOffset(now, timezone);
    const [hours, minutes, seconds] = localIso.slice(11, 19).split(':').map(Number);
    const localDayMs = (hours ?? 0) * 3_600_000 + (minutes ?? 0) * 60_000 + (seconds ?? 0) * 1000;
    const boundaryMs = dailyResetHour * 3_600_000;
    const sinceBoundaryMs = (localDayMs - boundaryMs + 86_400_000) % 86_400_000;
    return new Date(now.getTime() - sinceBoundaryMs);
}
