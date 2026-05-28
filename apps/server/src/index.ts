import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { startAgentRuntimeEventSync } from './agent-runtime/event-sync.ts';
import {
    confirmAgentRuntimeConnection,
    getCurrentAgentRuntimeUrl,
    loadAgentRuntimeConnection,
} from './agent-runtime-connection/service.ts';
import { createApiContext } from './api/context.ts';
import { apiEventSchedulerIntervals, startApiEventScheduler } from './api/events-scheduler.ts';
import { appRouter } from './api/router.ts';
import { startTrpcWebSocketServer } from './api/ws.ts';
import { env } from './config/env.ts';
import { ensureDatabaseSchema } from './db/bootstrap.ts';
import { startOrphanExitWatch } from './dev/orphan-exit-watch.ts';
import { startJobsManager } from './jobs/manager.ts';
import { isAllowedAppOrigin } from './origin.ts';
import {
    formatDurationMs,
    logStartupBanner,
    logStartupComplete,
    logStartupDetail,
    logStartupFailure,
    logStartupSection,
    shortenHomePath,
} from './startup-log.ts';
import { listConfiguredAgentRuntimeConnections } from './storage/agent-runtime-connections.ts';

async function start() {
    startOrphanExitWatch({
        enabled: process.env.TAVERN_EXIT_ON_ORPHAN === '1',
        exit: (code) => {
            process.exit(code);
        },
        getParentPid: () => process.ppid,
    });

    logStartupBanner('🎰 Tavern Server', 'Booting Tavern Runtime services');
    await ensureDatabaseSchema();
    await loadAgentRuntimeConnection();
    const agentRuntimeReachable = await confirmAgentRuntimeConnection();

    const app = Fastify({
        logger: false,
    });

    await app.register(cors, {
        origin: (origin, callback) => {
            callback(null, isAllowedAppOrigin(origin));
        },
        credentials: true,
    });

    await app.register(fastifyTRPCPlugin, {
        prefix: '/trpc',
        trpcOptions: {
            allowMethodOverride: true,
            createContext: createApiContext,
            router: appRouter,
        },
    });

    app.get('/healthz', async () => ({
        status: 'ok',
    }));

    await startJobsManager();

    await app.listen({
        host: '0.0.0.0',
        port: env.SERVER_PORT,
    });

    startTrpcWebSocketServer(app.server);
    startApiEventScheduler();
    startAgentRuntimeEventSync();
    void confirmAgentRuntimeConnection().catch((error) => {
        console.warn('[tavern] failed to refresh runtime capabilities', error);
    });
    const observedAgentRuntimeCount = (await listConfiguredAgentRuntimeConnections()).length;

    logStartupSection('Tavern Runtime');
    logStartupDetail('🗄️', 'Database', shortenHomePath(env.DATABASE_PATH));
    logStartupDetail('🌐', 'App origin', env.APP_ORIGIN);
    logStartupDetail('📡', 'HTTP', `http://localhost:${env.SERVER_PORT}`);
    logStartupDetail('🔌', 'WebSocket', `ws://localhost:${env.SERVER_PORT}/trpc`);
    logStartupDetail('🎮', 'Tavern Runtime', getCurrentAgentRuntimeUrl() ?? 'disabled');
    logStartupDetail(
        '👀',
        'Runtime observe',
        agentRuntimeReachable && observedAgentRuntimeCount > 0
            ? `${observedAgentRuntimeCount} connection(s)`
            : 'degraded'
    );
    logStartupDetail(
        '⏱️',
        'Usage refresh',
        formatDurationMs(apiEventSchedulerIntervals.usageIntervalMs)
    );
    logStartupComplete('Tavern is ready');
}

start().catch((error) => {
    logStartupFailure('Tavern boot failed');
    console.error(error);
    process.exitCode = 1;
});
