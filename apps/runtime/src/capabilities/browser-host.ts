import * as z from 'zod';
import { readConfigValue } from '../config.ts';
import type { RuntimeCapabilityCheckResult } from './definitions.ts';

const browserHostStatusSchema = z.object({
    browser: z.object({
        cdp: z.object({
            latencyMs: z.number().int().nonnegative().optional(),
            state: z.enum(['healthy', 'unknown', 'unreachable']),
        }),
        profile: z.object({
            compatible: z.boolean(),
            lockedByHost: z.boolean(),
        }),
        running: z.boolean(),
        version: z.string().optional(),
    }),
    checkedAt: z.string().datetime(),
    hostVersion: z.string().min(1),
    lease: z
        .object({
            expiresAt: z.string().datetime(),
            owner: z.string().min(1),
        })
        .nullable()
        .optional(),
    reason: z.string().min(1).optional(),
    recovery: z.object({
        automaticRestartLimit: z.number().int().nonnegative(),
        automaticRestartsInWindow: z.number().int().nonnegative(),
        enabled: z.boolean(),
        lastReceiptId: z.string().optional(),
        running: z.boolean(),
    }),
    resources: z.object({
        browserCpuPercent: z.number().nonnegative().optional(),
        browserRssBytes: z.number().int().nonnegative().optional(),
        gpuCpuPercent: z.number().nonnegative().optional(),
        gpuRssBytes: z.number().int().nonnegative().optional(),
        pressureSince: z.string().datetime().nullable().optional(),
    }),
    schemaVersion: z.literal(1),
    state: z.enum([
        'degraded',
        'healthy',
        'pressured',
        'recovering',
        'starting',
        'stopped',
        'unresponsive',
    ]),
});

export const checkBrowserHostCapability = async (): Promise<RuntimeCapabilityCheckResult> => {
    const configuredUrl = readConfigValue('TAVERN_BROWSER_HOST_URL');
    const baseUrl = configuredUrl ?? 'http://127.0.0.1:18442';
    const source = configuredUrl ? 'environment' : 'local-default';

    try {
        const response = await fetch(new URL('/v1/status', baseUrl), {
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            return {
                metadata: { source },
                reason: 'Browser supervision is unavailable.',
                state:
                    response.status === 401 || response.status === 403
                        ? 'unauthorized'
                        : 'unavailable',
                technicalMessage: `BrowserHost returned HTTP ${response.status}.`,
            };
        }

        const status = browserHostStatusSchema.parse(await response.json());
        const metadata = {
            browserCpuPercent: status.resources.browserCpuPercent,
            browserRssBytes: status.resources.browserRssBytes,
            browserState: status.state,
            browserVersion: status.browser.version,
            cdpLatencyMs: status.browser.cdp.latencyMs,
            cdpState: status.browser.cdp.state,
            checkedAt: status.checkedAt,
            gpuCpuPercent: status.resources.gpuCpuPercent,
            gpuRssBytes: status.resources.gpuRssBytes,
            hostVersion: status.hostVersion,
            lease: status.lease ?? null,
            pressureSince: status.resources.pressureSince ?? null,
            profileCompatible: status.browser.profile.compatible,
            profileLockedByHost: status.browser.profile.lockedByHost,
            recovery: status.recovery,
            source,
        };

        switch (status.state) {
            case 'healthy':
            case 'pressured':
                return { metadata, state: 'healthy' };
            case 'starting':
            case 'recovering':
                return {
                    metadata,
                    reason: status.reason ?? 'The browser is temporarily unavailable.',
                    state: 'degraded',
                };
            case 'degraded':
            case 'stopped':
            case 'unresponsive':
                return {
                    metadata,
                    reason: status.reason ?? 'The browser is unavailable.',
                    state: 'unavailable',
                };
        }
    } catch (error) {
        return {
            metadata: { source },
            reason: 'Browser supervision could not be reached.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
};
