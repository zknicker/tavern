import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeAgent } from '@tavern/api';
import { browserPluginId } from '@tavern/api/plugins/browser';
import { tool } from 'ai';
import * as z from 'zod';
import { type AgentBrowserRunner, SystemAgentBrowserRunner } from './browser/agent-browser-cli.ts';
import { type BrowserService, getBrowserService } from './browser/service.ts';
import { checkBrowserCapability } from './browser.ts';
import { getPlugin } from './store.ts';

const browserToolInputSchema = z.object({
    args: z
        .array(z.string())
        .min(1)
        .describe('agent-browser command and arguments, e.g. ["open", "https://example.com"].'),
});

const defaultRunner = new SystemAgentBrowserRunner();

export function createBrowserToolsForAgent(
    agent: AgentRuntimeAgent,
    runner: AgentBrowserRunner = defaultRunner
): ToolSet {
    if (
        !(
            (agent.enabledPluginIds ?? []).includes(browserPluginId) &&
            getPlugin(browserPluginId).enabled
        )
    ) {
        return {};
    }

    return {
        browser: tool({
            description:
                'Run a browser automation command in the managed Chrome browser. Accepts standard agent-browser arguments; see the browser skill for the command vocabulary.',
            inputSchema: browserToolInputSchema,
            execute: async (input) => await executeBrowserTool(input.args, runner),
        }),
    };
}

async function executeBrowserTool(args: string[], runner: AgentBrowserRunner) {
    const service = getBrowserService();
    if (!service) {
        return await unavailableResult();
    }

    // All browser commands share one process-wide FIFO: agents and turns
    // never race the single Chrome/CDP session, and an active command
    // inhibits automatic recovery.
    return await service.commandQueue.run(async () => {
        const readiness = await ensureBrowserReady(service);
        if (readiness) {
            return readiness;
        }
        try {
            const attachment = await service.lifecycle.attachment();
            return await runner.run(attachment.port, args);
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
            };
        }
    });
}

// A stopped browser is started on demand; a degraded browser fails fast with
// the current capability reason instead of attempting unsafe fallbacks.
async function ensureBrowserReady(service: BrowserService) {
    const status = await service.supervisor.status();
    if (status.state === 'stopped' || status.state === 'starting') {
        try {
            await service.supervisor.startBrowser();
            return null;
        } catch (error) {
            return {
                error: `The browser could not start: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                ok: false,
            };
        }
    }
    if (status.state === 'healthy' || status.state === 'pressured') {
        return null;
    }
    return await unavailableResult();
}

async function unavailableResult() {
    const capability = await checkBrowserCapability();
    return {
        error: capability.reason ?? 'The browser is unavailable.',
        ok: false,
    };
}
