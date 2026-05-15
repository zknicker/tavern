import Bottleneck from 'bottleneck';
import type { SkillPackageRecord } from './storage.ts';
import { listDueClawHubSkillPackages, saveSkillUpdateCheck } from './storage.ts';

const defaultClawHubUrl = 'https://clawhub.ai';
const updateCheckIntervalMs = 24 * 60 * 60 * 1000;
const maxRateLimitAttempts = 5;

const clawHubLimiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 1000,
});

interface ClawHubSkillDetail {
    latestVersion?: {
        createdAt?: number | null;
        version?: string | null;
    } | null;
    skill?: {
        updatedAt?: number | null;
    } | null;
}

export async function checkDueClawHubSkillUpdates(
    options: { log?: (message: string) => Promise<void> } = {}
) {
    const cutoffIso = new Date(Date.now() - updateCheckIntervalMs).toISOString();
    const packages = await listDueClawHubSkillPackages(cutoffIso);

    if (packages.length === 0) {
        await options.log?.('No ClawHub skill update checks are due.');
        return { checked: 0 };
    }

    await options.log?.(`Checking ${packages.length} installed ClawHub skill(s) for updates.`);

    let checked = 0;
    for (const skillPackage of packages) {
        const result = await checkClawHubSkillPackageForUpdates(skillPackage, options);
        checked += 1;

        if (result.ok) {
            const suffix = result.updateAvailable ? `; latest is ${result.latestVersion}` : '';
            await options.log?.(`Checked ${skillPackage.sourceSpec}: current${suffix}.`);
        } else {
            await options.log?.(`Could not check ${skillPackage.sourceSpec}: ${result.error}`);
        }
    }

    return { checked };
}

export async function checkClawHubSkillPackageForUpdates(
    skillPackage: SkillPackageRecord,
    options: {
        log?: (message: string) => Promise<void>;
    } = {}
) {
    if (skillPackage.sourceType !== 'clawhub') {
        throw new Error('Only ClawHub skills support update checks.');
    }

    const checkedAt = new Date().toISOString();
    try {
        const detail = await fetchClawHubSkillDetailWithRetries(skillPackage.sourceSpec, options);
        const latestVersion = normalizeString(detail.latestVersion?.version);
        const latestVersionCreatedAt = formatTimestamp(detail.latestVersion?.createdAt ?? null);
        const latestSourceUpdatedAt = formatTimestamp(detail.skill?.updatedAt ?? null);

        await saveSkillUpdateCheck({
            latestCheckError: null,
            latestCheckedAt: checkedAt,
            latestSourceUpdatedAt,
            latestVersion,
            latestVersionCreatedAt,
            skillPackageId: skillPackage.id,
        });

        return {
            latestVersion,
            ok: true as const,
            updateAvailable:
                latestVersion !== null && latestVersion !== skillPackage.resolvedVersion,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await saveSkillUpdateCheck({
            latestCheckError: message,
            latestCheckedAt: checkedAt,
            latestSourceUpdatedAt: skillPackage.latestSourceUpdatedAt,
            latestVersion: skillPackage.latestVersion,
            latestVersionCreatedAt: skillPackage.latestVersionCreatedAt,
            skillPackageId: skillPackage.id,
        });

        return {
            error: message,
            ok: false as const,
        };
    }
}

async function fetchClawHubSkillDetailWithRetries(
    slug: string,
    options: {
        log?: (message: string) => Promise<void>;
    }
) {
    let attempt = 0;

    while (true) {
        try {
            return await clawHubLimiter.schedule(() => fetchClawHubSkillDetail(slug));
        } catch (error) {
            if (!(error instanceof ClawHubRateLimitError) || attempt >= maxRateLimitAttempts) {
                throw error;
            }

            attempt += 1;
            await options.log?.(
                `ClawHub rate limited update checks; waiting ${formatDelay(error.retryAfterMs)}.`
            );
            await sleep(error.retryAfterMs);
        }
    }
}

async function fetchClawHubSkillDetail(slug: string): Promise<ClawHubSkillDetail> {
    const url = new URL(`/api/v1/skills/${encodeURIComponent(slug)}`, defaultClawHubUrl);
    const response = await fetch(url);

    if (response.status === 429) {
        throw new ClawHubRateLimitError(resolveRateLimitDelayMs(response.headers));
    }
    if (!response.ok) {
        throw new Error(`ClawHub returned ${response.status} for ${slug}.`);
    }

    return (await response.json()) as ClawHubSkillDetail;
}

class ClawHubRateLimitError extends Error {
    constructor(readonly retryAfterMs: number) {
        super(`ClawHub rate limited the request; retry after ${formatDelay(retryAfterMs)}.`);
    }
}

function resolveRateLimitDelayMs(headers: Headers) {
    return (
        parseRetryAfterMs(headers.get('Retry-After')) ??
        parseRelativeSecondsMs(headers.get('RateLimit-Reset')) ??
        parseEpochSecondsMs(headers.get('X-RateLimit-Reset')) ??
        60_000
    );
}

function parseRetryAfterMs(value: string | null) {
    if (!value) {
        return null;
    }

    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
        return Math.max(0, seconds * 1000);
    }

    const dateMs = Date.parse(value);
    return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - Date.now());
}

function parseRelativeSecondsMs(value: string | null) {
    const seconds = value ? Number(value) : Number.NaN;
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
}

function parseEpochSecondsMs(value: string | null) {
    const seconds = value ? Number(value) : Number.NaN;
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000 - Date.now()) : null;
}

function normalizeString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function formatTimestamp(value: number | null) {
    return typeof value === 'number' && Number.isFinite(value)
        ? new Date(value).toISOString()
        : null;
}

function formatDelay(ms: number) {
    return `${Math.ceil(ms / 1000)}s`;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
