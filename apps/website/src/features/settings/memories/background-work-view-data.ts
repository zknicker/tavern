import type {
    MemoryJobDetail,
    MemoryJobSummary,
    MemoryWorkerNextRun,
    MemoryWorkerStatus,
} from '@tavern/api';
import type { BadgeProps } from '../../../components/ui/badge.tsx';

/** tRPC output inference relaxes z.unknown() metadata into optional records. */
export type WorkerReportView = Omit<MemoryJobDetail, 'metadata' | 'transcript' | 'usage'> & {
    metadata?: Record<string, unknown>;
    transcript?: unknown;
    usage?: unknown;
};

type WorkerKind = MemoryWorkerStatus['kind'];
type WorkerStatus = MemoryJobSummary['status'];

export interface WorkerProfile {
    kind: WorkerKind;
    name: string;
    purpose: string;
}

/** Ordered worker profiles: human name plus a one-line purpose per kind. */
export const workerProfiles: readonly WorkerProfile[] = [
    {
        kind: 'extraction',
        name: 'Extraction',
        purpose: 'Distills settled chats into episodic evidence.',
    },
    {
        kind: 'dream',
        name: 'Dreaming',
        purpose: 'Promotes stable evidence into core and shared Memory.',
    },
    {
        kind: 'skill_review',
        name: 'Skill review',
        purpose: 'Turns corrections and techniques into skill updates.',
    },
    {
        kind: 'curation',
        name: 'Curation',
        purpose: 'Consolidates and prunes the skill library.',
    },
];

const workerNameByKind: Record<WorkerKind, string> = {
    curation: 'Curation',
    dream: 'Dreaming',
    extraction: 'Extraction',
    skill_review: 'Skill review',
};

export function workerName(kind: WorkerKind): string {
    return workerNameByKind[kind];
}

const statusLabels: Record<WorkerStatus, string> = {
    completed: 'Completed',
    failed: 'Failed',
    queued: 'Queued',
    running: 'Running',
    skipped: 'Skipped',
};

export function workerStatusLabel(status: WorkerStatus): string {
    return statusLabels[status];
}

export function workerStatusVariant(status: WorkerStatus): BadgeProps['variant'] {
    switch (status) {
        case 'completed':
            return 'success';
        case 'failed':
            return 'error';
        case 'running':
            return 'info';
        case 'queued':
            return 'subtle';
        default:
            return 'secondary';
    }
}

/**
 * Token-backed dot color per status. success/info/error carry outcome; skipped
 * and anything neutral fall back to the muted family. No hand-rolled colors.
 */
export function workerStatusDotClassName(status: WorkerStatus): string {
    switch (status) {
        case 'completed':
            return 'bg-success';
        case 'failed':
            return 'bg-error';
        case 'running':
        case 'queued':
            return 'bg-info';
        default:
            return 'bg-muted-foreground/55';
    }
}

/** Compact duration for the worker table and run rows. */
export function formatDuration(durationMs: number | null): string | null {
    if (durationMs === null || durationMs < 0) {
        return null;
    }
    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }
    const seconds = durationMs / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** "in 2h" for scheduled runs, or the plain condition a waiting worker needs. */
export function formatNextRun(nextRun: MemoryWorkerNextRun | null, enabled: boolean): string {
    if (!enabled) {
        return '—';
    }
    if (!nextRun) {
        return '—';
    }
    if (nextRun.kind === 'waiting') {
        return `Waiting on ${nextRun.waitingOn}`;
    }
    return formatUntil(nextRun.at);
}

function formatUntil(at: string): string {
    const target = Date.parse(at);
    if (!Number.isFinite(target)) {
        return 'Scheduled';
    }
    const diffMs = target - Date.now();
    if (diffMs <= 60_000) {
        return 'Any moment';
    }
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 60) {
        return `in ${minutes}m`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `in ${hours}h`;
    }
    const days = Math.round(hours / 24);
    return `in ${days}d`;
}

/** Timeline lane rows, one per worker kind, newest run at the front of each lane. */
export interface TimelineLane {
    kind: WorkerKind;
    name: string;
    runs: MemoryJobSummary[];
}

export function buildTimelineLanes(jobs: MemoryJobSummary[]): TimelineLane[] {
    return workerProfiles.map((profile) => ({
        kind: profile.kind,
        name: profile.name,
        runs: jobs
            .filter((job) => job.kind === profile.kind)
            .sort((left, right) => timelineTime(right) - timelineTime(left)),
    }));
}

export function timelineTime(job: MemoryJobSummary): number {
    return Date.parse(job.completedAt ?? job.createdAt);
}

// --- Report metadata parsers (loose JSON; missing fields simply don't render) ---

export function readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface ReportEntry {
    reason: string | null;
    text: string;
}

export function readSignals(metadata: Record<string, unknown> | undefined): string[] {
    return readStringList(metadata?.signals, (item) => {
        if (typeof item === 'string') {
            return item;
        }
        const record = asRecord(item);
        const detail = readString(record?.detail);
        const kind = readString(record?.kind);
        if (detail && kind) {
            return `${kind}: ${detail}`;
        }
        return detail ?? kind;
    });
}

export interface SkillAction {
    path: string;
    skillId: string;
    tool: string;
}

export function readSkillActions(metadata: Record<string, unknown> | undefined): SkillAction[] {
    return asArray(metadata?.actions).flatMap((item) => {
        const record = asRecord(item);
        const skillId = readString(record?.skillId);
        if (!skillId) {
            return [];
        }
        return [
            {
                path: readString(record?.path) ?? 'SKILL.md',
                skillId,
                tool: readString(record?.tool) ?? 'update',
            },
        ];
    });
}

export interface ReportBlock {
    text: string;
    toolErrors: Array<{ error: string; tool: string }>;
}

export function readReport(metadata: Record<string, unknown> | undefined): ReportBlock | null {
    const report = asRecord(metadata?.report);
    if (!report) {
        return null;
    }
    const text = readString(report.text);
    const toolErrors = asArray(report.toolErrors).flatMap((item) => {
        const record = asRecord(item);
        const error = readString(record?.error);
        return error ? [{ error, tool: readString(record?.tool) ?? 'tool' }] : [];
    });
    if (!(text || toolErrors.length > 0)) {
        return null;
    }
    return { text: text ?? '', toolErrors };
}

export interface Consolidation {
    from: string;
    into: string;
    reason: string | null;
}

export function readConsolidations(metadata: Record<string, unknown> | undefined): Consolidation[] {
    return asArray(metadata?.consolidations).flatMap((item) => {
        const record = asRecord(item);
        const from = readString(record?.from);
        const into = readString(record?.into);
        if (!(from && into)) {
            return [];
        }
        return [{ from, into, reason: readString(record?.reason) }];
    });
}

export interface Pruning {
    name: string;
    reason: string | null;
}

export function readPrunings(metadata: Record<string, unknown> | undefined): Pruning[] {
    return asArray(metadata?.prunings).flatMap((item) => {
        const record = asRecord(item);
        const name = readString(record?.name);
        return name ? [{ name, reason: readString(record?.reason) }] : [];
    });
}

export interface Transition {
    from: string | null;
    skillId: string;
    to: string | null;
}

export function readTransitions(metadata: Record<string, unknown> | undefined): Transition[] {
    return asArray(metadata?.transitions).flatMap((item) => {
        const record = asRecord(item);
        const skillId = readString(record?.skillId);
        if (!skillId) {
            return [];
        }
        return [
            {
                from: readString(record?.previousState),
                skillId,
                to: readString(record?.nextState),
            },
        ];
    });
}

export function readObservations(metadata: Record<string, unknown> | undefined): string | null {
    return readString(metadata?.observations);
}

export function readDreamSummary(metadata: Record<string, unknown> | undefined): string | null {
    return readString(metadata?.summary);
}

function readStringList(value: unknown, map: (item: unknown) => string | null): string[] {
    return asArray(value).flatMap((item) => {
        const mapped = map(item);
        return mapped ? [mapped] : [];
    });
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
