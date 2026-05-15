import { z } from 'zod';

const openRouterActivityDatePattern = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;

const openRouterActivityRowSchema = z.object({
    byok_usage_inference: z.number(),
    completion_tokens: z.number(),
    date: z.string().transform(normalizeOpenRouterActivityDate),
    endpoint_id: z.string(),
    model: z.string(),
    model_permaslug: z.string(),
    prompt_tokens: z.number(),
    provider_name: z.string(),
    reasoning_tokens: z.number(),
    requests: z.number(),
    usage: z.number(),
});

const openRouterActivityResponseSchema = z.object({
    data: z.array(openRouterActivityRowSchema),
});

type OpenRouterActivityResponse = z.infer<typeof openRouterActivityResponseSchema>;

const invalidApiKeyMessage =
    'OpenRouter management key looks invalid. Save a valid management key.';
const invalidResponseMessage = 'OpenRouter activity returned an unexpected response.';

export interface OpenRouterActivityError {
    code: 'auth' | 'parse' | 'request' | 'unknown';
    message: string;
}

export interface OpenRouterActivityKey {
    id: string;
    label: string;
    providerName: string;
}

export interface OpenRouterActivityPoint {
    date: string;
    values: Record<string, number>;
}

export interface OpenRouterActivityOverview {
    days: number;
    keys: OpenRouterActivityKey[];
    message: string | null;
    note: string | null;
    series: OpenRouterActivityPoint[];
    status: 'empty' | 'ready' | 'unconfigured';
    totalByokUsageUsd: number;
    totalRequests: number;
    totalUsageUsd: number;
}

export async function getOpenRouterActivityOverview(
    apiKey: string,
    capturedAt: Date = new Date()
): Promise<OpenRouterActivityOverview> {
    const response = await fetchOpenRouterActivity(apiKey);
    return buildOpenRouterActivityOverview(response, capturedAt);
}

export function createEmptyOpenRouterActivityOverview(
    status: OpenRouterActivityOverview['status'],
    message: string | null,
    capturedAt: Date = new Date()
): OpenRouterActivityOverview {
    const dates = buildUtcDates(capturedAt, 30);

    return {
        days: dates.length,
        keys: [],
        message,
        note: null,
        series: dates.map((date) => ({
            date,
            values: {},
        })),
        status,
        totalByokUsageUsd: 0,
        totalRequests: 0,
        totalUsageUsd: 0,
    };
}

export function buildOpenRouterActivityOverview(
    response: OpenRouterActivityResponse,
    capturedAt: Date = new Date()
): OpenRouterActivityOverview {
    const dates = buildUtcDates(capturedAt, 30);
    const dateSet = new Set(dates);
    const groupedByKey = new Map<
        string,
        {
            label: string;
            providerName: string;
            totalUsageUsd: number;
        }
    >();
    const seriesMap = new Map<string, OpenRouterActivityPoint>(
        dates.map((date) => [
            date,
            {
                date,
                values: {},
            },
        ])
    );

    let totalUsageUsd = 0;
    let totalByokUsageUsd = 0;
    let totalRequests = 0;

    for (const row of response.data) {
        if (!dateSet.has(row.date)) {
            continue;
        }

        const keyId = toOpenRouterActivityKeyId(row.model_permaslug);
        const usageValue = row.usage + row.byok_usage_inference;
        const point = seriesMap.get(row.date);
        const key = groupedByKey.get(keyId);

        totalUsageUsd += row.usage;
        totalByokUsageUsd += row.byok_usage_inference;
        totalRequests += row.requests;

        if (point) {
            point.values[keyId] = (point.values[keyId] ?? 0) + usageValue;
        }

        if (key) {
            key.totalUsageUsd += usageValue;
            continue;
        }

        groupedByKey.set(keyId, {
            label: row.model_permaslug,
            providerName: row.provider_name,
            totalUsageUsd: usageValue,
        });
    }

    const keys = [...groupedByKey.entries()]
        .map(([id, key]) => ({
            id,
            label: key.label,
            providerName: key.providerName,
            totalUsageUsd: key.totalUsageUsd,
        }))
        .sort(
            (left, right) =>
                right.totalUsageUsd - left.totalUsageUsd || left.label.localeCompare(right.label)
        )
        .map(({ totalUsageUsd: _totalUsageUsd, ...key }) => key);

    for (const point of seriesMap.values()) {
        for (const key of keys) {
            point.values[key.id] ??= 0;
        }
    }

    return {
        days: dates.length,
        keys,
        message:
            keys.length === 0 ? 'No OpenRouter activity returned for the last 30 UTC days.' : null,
        note:
            keys.length > 0
                ? 'Daily account activity includes OpenRouter credit spend and BYOK inference spend.'
                : null,
        series: dates.map((date) => {
            const point = seriesMap.get(date);

            if (!point) {
                throw new Error(`Missing OpenRouter activity bucket ${date}`);
            }

            return point;
        }),
        status: keys.length > 0 ? 'ready' : 'empty',
        totalByokUsageUsd,
        totalRequests,
        totalUsageUsd,
    };
}

async function fetchOpenRouterActivity(apiKey: string): Promise<OpenRouterActivityResponse> {
    let response: Response;

    try {
        response = await fetch('https://openrouter.ai/api/v1/activity', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        });
    } catch (error) {
        throw createOpenRouterActivityError(
            'request',
            toOpenRouterActivityRequestErrorMessage(error)
        );
    }

    if (!response.ok) {
        const code = response.status === 401 || response.status === 403 ? 'auth' : 'request';
        let message = `OpenRouter activity request failed with status ${response.status}.`;

        if (response.status === 401) {
            message = 'OpenRouter rejected the saved key.';
        } else if (response.status === 403) {
            message = 'OpenRouter activity requires an account management key.';
        }

        throw createOpenRouterActivityError(code, message);
    }

    let payload: unknown;

    try {
        payload = await response.json();
    } catch (error) {
        throw createOpenRouterActivityError(
            'parse',
            error instanceof Error && error.message
                ? invalidResponseMessage
                : invalidResponseMessage
        );
    }

    const parsed = openRouterActivityResponseSchema.safeParse(payload);

    if (!parsed.success) {
        throw createOpenRouterActivityError('parse', invalidResponseMessage);
    }

    return parsed.data;
}

function buildUtcDates(capturedAt: Date, days: number): string[] {
    const currentUtcDay = new Date(
        Date.UTC(capturedAt.getUTCFullYear(), capturedAt.getUTCMonth(), capturedAt.getUTCDate())
    );

    return Array.from({ length: days }, (_, index) => {
        const offsetDays = days - index - 1;
        const date = new Date(currentUtcDay);
        date.setUTCDate(currentUtcDay.getUTCDate() - offsetDays);
        return date.toISOString().slice(0, 10);
    });
}

function createOpenRouterActivityError(
    code: OpenRouterActivityError['code'],
    message: string
): Error & { details: OpenRouterActivityError } {
    const error = new Error(message) as Error & { details: OpenRouterActivityError };

    error.details = {
        code,
        message,
    };

    return error;
}

function toOpenRouterActivityKeyId(modelPermaslug: string) {
    return modelPermaslug.trim().toLowerCase();
}

export function toOpenRouterActivityRequestErrorMessage(error: unknown) {
    if (!(error instanceof Error)) {
        return 'OpenRouter activity request failed.';
    }

    const message = error.message.toLowerCase();

    if (
        message.includes('invalid value') ||
        message.includes('headers.append') ||
        message.includes('authorization')
    ) {
        return invalidApiKeyMessage;
    }

    return 'OpenRouter activity request failed.';
}

export function normalizeOpenRouterActivityDate(value: string) {
    if (!openRouterActivityDatePattern.test(value)) {
        throw new Error(invalidResponseMessage);
    }

    return value.slice(0, 10);
}
