import { getSessionDisplay } from '../sessions/display.ts';
import { listRuntimeSessions } from '../sessions/runtime-sessions.ts';
import type { GlobalSubAgent } from './contracts.ts';

export async function listSubAgents(): Promise<GlobalSubAgent[]> {
    const sessions = await listRuntimeSessions();

    return sessions.flatMap((session) => {
        if (session.sessionRole !== 'worker' || !session.parentSessionKey) {
            return [];
        }

        const display = getSessionDisplay({
            key: session.key,
            title: session.title,
        });

        return [
            {
                id: session.key,
                lastActiveAt:
                    session.lastActivityAt ?? session.startedAt ?? new Date(0).toISOString(),
                logExcerpt: '',
                name: display.name,
                parentId: session.parentSessionKey,
                relationship: 'spawned',
                state: 'idle',
                task: display.name,
            } satisfies GlobalSubAgent,
        ];
    });
}
