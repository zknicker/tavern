import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
    type AgentRuntimeBrowserActionResult,
    type AgentRuntimeBrowserSettings,
    type AgentRuntimeBrowserStatus,
    type AgentRuntimePlugin,
    type AgentRuntimeSaveBrowserSettings,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserProfileNameSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimePluginSchema,
    agentRuntimeSaveBrowserSettingsSchema,
} from '@tavern/api';
import { browserPluginId } from '@tavern/api/plugins/browser';
import * as z from 'zod';
import type { RuntimeCapabilityCheckResult } from '../capabilities/definitions';
import { detectChromeApplications } from './browser/chrome-detection.ts';
import { getBrowserService, startBrowserService, stopBrowserService } from './browser/service.ts';
import { getPlugin, readPluginConfig, writePluginConfig } from './store';

const execFileAsync = promisify(execFile);

export const defaultBrowserProfileName = 'default';

const storedBrowserConfigSchema = z.object({
    profileName: agentRuntimeBrowserProfileNameSchema.default(defaultBrowserProfileName),
});

export function getBrowserPlugin(): AgentRuntimePlugin {
    const stored = getPlugin(browserPluginId);
    const config = readPluginConfig(browserPluginId, storedBrowserConfigSchema);

    return agentRuntimePluginSchema.parse({
        ...stored,
        config: { profileName: config.profileName },
        secrets: [],
    });
}

export async function getBrowserSettings(): Promise<AgentRuntimeBrowserSettings> {
    const plugin = getPlugin(browserPluginId);
    const config = readPluginConfig(browserPluginId, storedBrowserConfigSchema);
    const service = getBrowserService();
    const [application] = service ? [service.application] : await detectChromeApplications();

    return agentRuntimeBrowserSettingsSchema.parse({
        application: application ? { path: application.path, version: application.version } : null,
        enabled: plugin.enabled,
        profileName: config.profileName,
        skillConflict: null,
        status: service ? await service.supervisor.status() : null,
        updatedAt: plugin.updatedAt,
    });
}

export async function saveBrowserSettings(
    input: AgentRuntimeSaveBrowserSettings
): Promise<AgentRuntimeBrowserSettings> {
    const parsed = agentRuntimeSaveBrowserSettingsSchema.parse(input);
    const plugin = getPlugin(browserPluginId);
    const current = readPluginConfig(browserPluginId, storedBrowserConfigSchema);
    const profileName = parsed.profileName ?? current.profileName;
    const enabled = parsed.enabled ?? plugin.enabled;

    // Switching profiles is an explicit operator action: the old managed
    // Chrome is stopped gracefully first so it does not keep writing the old
    // profile unsupervised. Profile directories are never deleted.
    const service = getBrowserService();
    if (service && profileName !== service.profileName) {
        await service.lifecycle.stop().catch(() => undefined);
    }

    writePluginConfig({ config: { profileName }, enabled, id: browserPluginId });
    await reconcileBrowserService();
    return getBrowserSettings();
}

// Starts or stops browser supervision to match stored settings. Called on
// Runtime startup and after settings changes; failures degrade the
// `plugin.browser` capability instead of propagating.
export async function reconcileBrowserService(): Promise<void> {
    const plugin = getPlugin(browserPluginId);
    if (!plugin.enabled) {
        stopBrowserService();
        return;
    }
    const config = readPluginConfig(browserPluginId, storedBrowserConfigSchema);
    await startBrowserService({ profileName: config.profileName });
}

export async function checkBrowserCapability(): Promise<RuntimeCapabilityCheckResult> {
    const plugin = getPlugin(browserPluginId);
    if (!plugin.enabled) {
        return { reason: 'Browser is disabled.', state: 'unavailable' };
    }
    if (process.platform !== 'darwin') {
        return {
            reason: 'Browser requires a macOS Runtime host.',
            state: 'unavailable',
        };
    }

    const service = getBrowserService();
    if (!service) {
        const [application] = await detectChromeApplications();
        if (!application) {
            return {
                reason: 'Install Google Chrome to enable Browser.',
                state: 'unavailable',
            };
        }
        return {
            reason: 'Browser supervision is not running.',
            state: 'unavailable',
        };
    }

    const status = await service.supervisor.status();
    return mapBrowserStatusToCapability(status, service.profileName);
}

function mapBrowserStatusToCapability(
    status: AgentRuntimeBrowserStatus,
    profileName: string
): RuntimeCapabilityCheckResult {
    const metadata: Record<string, unknown> = {
        browserVersion: status.browserVersion,
        profileName,
        state: status.state,
    };
    switch (status.state) {
        case 'healthy':
            return { metadata, state: 'healthy' };
        case 'pressured':
            // Pressure stays healthy: browser work remains available and
            // pressure alone never restarts Chrome.
            return {
                metadata: {
                    ...metadata,
                    gpuCpuPercent: status.resources.gpuCpuPercent,
                    pressureSince: status.pressureSince,
                },
                state: 'healthy',
            };
        case 'starting':
        case 'recovering':
            return {
                metadata,
                reason: status.reason ?? 'Browser is temporarily unavailable.',
                state: 'degraded',
            };
        default:
            return {
                metadata,
                reason: status.reason ?? 'Browser is unavailable.',
                state: 'unavailable',
            };
    }
}

export async function openBrowser(): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService();
    await service.supervisor.startBrowser();
    await activateChrome();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

export async function restartBrowser(): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService();
    await service.supervisor.restartBrowser();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

async function requireBrowserService() {
    await reconcileBrowserService();
    const service = getBrowserService();
    if (!service) {
        const capability = await checkBrowserCapability();
        throw new Error(capability.reason ?? 'Browser is unavailable.');
    }
    return service;
}

async function activateChrome(): Promise<void> {
    try {
        await execFileAsync(
            '/usr/bin/osascript',
            ['-e', 'tell application "Google Chrome" to activate'],
            { timeout: 5000 }
        );
    } catch {
        // Activation is best-effort; the browser is running either way.
    }
}
