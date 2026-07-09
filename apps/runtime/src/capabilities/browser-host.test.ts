import { afterEach, describe, expect, test, vi } from 'vitest';
import { checkBrowserHostCapability } from './browser-host.ts';

const originalUrl = process.env.TAVERN_BROWSER_HOST_URL;

afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) {
        Reflect.deleteProperty(process.env, 'TAVERN_BROWSER_HOST_URL');
    } else {
        process.env.TAVERN_BROWSER_HOST_URL = originalUrl;
    }
});

describe('BrowserHost capability', () => {
    test('uses the local loopback adapter by default', async () => {
        process.env.TAVERN_BROWSER_HOST_URL = '';
        const fetchMock = vi.fn(async () => {
            throw new Error('connection refused');
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(checkBrowserHostCapability()).resolves.toMatchObject({
            metadata: { source: 'local-default' },
            reason: 'Browser supervision could not be reached.',
            state: 'unavailable',
        });
        expect(fetchMock).toHaveBeenCalledWith(
            new URL('http://127.0.0.1:18442/v1/status'),
            expect.any(Object)
        );
    });

    test('keeps a pressured responsive browser available with pressure metadata', async () => {
        process.env.TAVERN_BROWSER_HOST_URL = 'https://browser-host.test:18443';
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json(statusFixture({ state: 'pressured' })))
        );

        await expect(checkBrowserHostCapability()).resolves.toMatchObject({
            metadata: {
                browserState: 'pressured',
                cdpState: 'healthy',
                gpuCpuPercent: 99.4,
                pressureSince: '2026-07-09T20:00:00Z',
                source: 'environment',
            },
            state: 'healthy',
        });
    });

    test('maps an unresponsive browser to unavailable', async () => {
        process.env.TAVERN_BROWSER_HOST_URL = 'https://browser-host.test:18443';
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json(
                    statusFixture({
                        cdpState: 'unreachable',
                        reason: 'Chrome is alive but CDP has remained unreachable.',
                        state: 'unresponsive',
                    })
                )
            )
        );

        await expect(checkBrowserHostCapability()).resolves.toMatchObject({
            metadata: {
                browserState: 'unresponsive',
                cdpState: 'unreachable',
            },
            reason: 'Chrome is alive but CDP has remained unreachable.',
            state: 'unavailable',
        });
    });
});

function statusFixture(input: {
    cdpState?: 'healthy' | 'unreachable';
    reason?: string;
    state: 'pressured' | 'unresponsive';
}) {
    return {
        browser: {
            cdp: {
                latencyMs: input.cdpState === 'unreachable' ? undefined : 12,
                state: input.cdpState ?? 'healthy',
            },
            profile: {
                compatible: true,
                lockedByHost: false,
            },
            running: true,
            version: '150.0.0.0',
        },
        checkedAt: '2026-07-09T20:01:00Z',
        hostVersion: '0.1.0',
        reason: input.reason,
        recovery: {
            automaticRestartLimit: 2,
            automaticRestartsInWindow: 0,
            enabled: false,
            running: false,
        },
        resources: {
            browserCpuPercent: 1.2,
            browserRssBytes: 100_000_000,
            gpuCpuPercent: 99.4,
            gpuRssBytes: 50_000_000,
            pressureSince: '2026-07-09T20:00:00Z',
        },
        schemaVersion: 1,
        state: input.state,
    };
}
