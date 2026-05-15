import { startQaMockOpenAiServer } from './mock-provider/server.ts';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.TAVERN_MOCK_PROVIDER_PORT ?? '44080', 10);
const provider = await startQaMockOpenAiServer({ host, port });

console.log(`[tavern-e2e] OpenClaw mock provider running at ${provider.baseUrl}`);

async function shutdown() {
    await provider.stop();
    process.exit(0);
}

process.on('SIGINT', () => {
    void shutdown();
});
process.on('SIGTERM', () => {
    void shutdown();
});

await new Promise(() => {});
