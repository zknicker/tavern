import type { CronListOutput, WorkerListOutput } from '../../lib/trpc.tsx';

type OverviewCronJob = Pick<CronListOutput['jobs'][number], 'enabled' | 'state'>;
type OverviewWorker = Pick<WorkerListOutput['workers'][number], 'status'>;

type OverviewHeadingPhraseKey =
    | 'activeMany'
    | 'activeOne'
    | 'attention'
    | 'deepNight'
    | 'evening'
    | 'memory'
    | 'midday'
    | 'morning'
    | 'scheduled'
    | 'sessions';

interface BuildOverviewHeadingInput {
    jobs: OverviewCronJob[];
    memoryCount: number;
    now?: Date;
    sessionsCount: number;
    workers: OverviewWorker[];
}

const activeWorkerStatuses = new Set(['queued', 'running', 'waiting']);
const attentionWorkerStatuses = new Set(['blocked', 'failed', 'timed_out', 'lost']);
const failedRunStatuses = new Set(['error']);

export const overviewHeadingPhrases: Record<OverviewHeadingPhraseKey, string[]> = {
    activeMany: [
        'Adventurers crowd the quest board.',
        'The guildhall crackles with errands.',
        'Quests stack beside the hearth.',
    ],
    activeOne: [
        'One quest burns by candlelight.',
        'A lone errand gathers sparks.',
        'One scroll waits under wax.',
    ],
    attention: [
        'A cursed ember needs tending.',
        'Red runes flash behind the bar.',
        'The warding bell rings twice.',
    ],
    deepNight: [
        'The tavern is quiet tonight, Zach.',
        'Moonlight keeps the tables hushed.',
        'The midnight hearth glows low.',
    ],
    evening: [
        'Lanterns glow for weary heroes.',
        'Supper smoke curls through rafters.',
        'The hearth sings after sundown.',
    ],
    memory: [
        'The archive whispers old lore.',
        'Dusty tomes remember your quests.',
        'Old runes shimmer on shelves.',
    ],
    midday: [
        'Welcome in, traveler. Mead flows freely.',
        'Sunlit flagons line the counter.',
        'The noon crowd wants legends.',
    ],
    morning: [
        'Dawn spills gold across flagons.',
        'Fresh bread warms the common room.',
        'Morning light blesses the hearth.',
    ],
    scheduled: [
        'Clockwork quests await their bell.',
        'The hourglass summons fresh work.',
        'Timed scrolls wait in order.',
    ],
    sessions: [
        'Old tales linger by firelight.',
        'Your last quest still smolders.',
        'The storybook waits open tonight.',
    ],
};

export function buildOverviewHeading({
    jobs,
    memoryCount,
    now = new Date(),
    sessionsCount,
    workers,
}: BuildOverviewHeadingInput) {
    const activeWorkerCount = workers.filter((worker) =>
        activeWorkerStatuses.has(worker.status)
    ).length;
    const attentionWorkerCount = workers.filter((worker) =>
        attentionWorkerStatuses.has(worker.status)
    ).length;
    const runningJobCount = jobs.filter((job) => typeof job.state.runningAtMs === 'number').length;
    const attentionJobCount = jobs.filter((job) =>
        failedRunStatuses.has(job.state.lastRunStatus ?? '')
    ).length;
    const enabledJobCount = jobs.filter((job) => job.enabled).length;
    const openIssueCount = attentionWorkerCount + attentionJobCount;

    return getStatePhrase({
        activeWorkerCount,
        enabledJobCount,
        memoryCount,
        now,
        openIssueCount,
        runningJobCount,
        sessionsCount,
    });
}

function getStatePhrase({
    activeWorkerCount,
    enabledJobCount,
    memoryCount,
    now,
    openIssueCount,
    runningJobCount,
    sessionsCount,
}: {
    activeWorkerCount: number;
    enabledJobCount: number;
    memoryCount: number;
    now: Date;
    openIssueCount: number;
    runningJobCount: number;
    sessionsCount: number;
}) {
    if (activeWorkerCount > 1) {
        return pickPhrase('activeMany', now);
    }

    if (activeWorkerCount === 1) {
        return pickPhrase('activeOne', now);
    }

    if (runningJobCount > 0) {
        return pickPhrase('scheduled', now);
    }

    if (openIssueCount > 0) {
        return pickPhrase('attention', now);
    }

    if (enabledJobCount > 0) {
        return pickPhrase('scheduled', now);
    }

    if (sessionsCount > 0) {
        return pickPhrase('sessions', now);
    }

    if (memoryCount > 0) {
        return pickPhrase('memory', now);
    }

    return getIdleTimePhrase(now);
}

function getIdleTimePhrase(now: Date) {
    const hour = now.getHours();

    if (hour < 5) {
        return pickPhrase('deepNight', now);
    }

    if (hour < 12) {
        return pickPhrase('morning', now);
    }

    if (hour < 17) {
        return pickPhrase('midday', now);
    }

    if (hour < 21) {
        return pickPhrase('evening', now);
    }

    return pickPhrase('deepNight', now);
}

function pickPhrase(key: OverviewHeadingPhraseKey, now: Date) {
    const phrases = overviewHeadingPhrases[key];
    return phrases[getPhraseIndex(key, now, phrases.length)] ?? phrases[0];
}

function getPhraseIndex(key: OverviewHeadingPhraseKey, now: Date, phraseCount: number) {
    const salt = key.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return (now.getDate() + now.getHours() + salt) % phraseCount;
}
