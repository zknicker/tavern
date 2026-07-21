import { describe, expect, test } from 'vitest';
import type { CronListOutput } from '../../../lib/trpc.tsx';
import { selectAgentReminders } from './reminders.ts';

const jobs = [
    createJob({ agentId: 'agent-a', id: 'job-a' }),
    createJob({ agentId: 'agent-b', id: 'job-b' }),
] satisfies CronListOutput['jobs'];

describe('selectAgentReminders', () => {
    test('keeps only reminders owned by the requested agent', () => {
        expect(selectAgentReminders(jobs, 'agent-a').map((job) => job.id)).toEqual(['job-a']);
    });

    test('returns the empty-state input when the agent has no reminders', () => {
        expect(selectAgentReminders(jobs, 'missing')).toEqual([]);
    });
});

function createJob(input: { agentId: string; id: string }): CronListOutput['jobs'][number] {
    return {
        agentId: input.agentId,
        description: null,
        enabled: true,
        id: input.id,
        mode: 'agentTurn',
        name: input.id,
        schedule: { everyMs: 60_000, kind: 'every' },
        state: {},
        updatedAt: '2026-07-21T12:00:00.000Z',
    };
}
