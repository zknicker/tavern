import { getSessionDisplay } from '../sessions/display.ts';
import { listSessionProjections, parseSessionProjection } from '../storage/sessions.ts';
import type { GlobalSubAgent } from './contracts.ts';

export async function listSubAgents(): Promise<GlobalSubAgent[]> {
    const sessionRecords = await listSessionProjections();
    const sessions = sessionRecords.flatMap((record) => {
        const session = parseSessionProjection(record);
        return session ? [session] : [];
    });

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
