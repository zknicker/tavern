import { createHermesModelProviderMock } from './mock-provider.ts';

const port = Number.parseInt(process.env.TAVERN_HERMES_PROVIDER_PORT ?? '44080', 10);
const provider = createHermesModelProviderMock({ port });

console.log(`[tavern-e2e] Hermes model provider mock running at ${provider.baseUrl}`);

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

await new Promise(() => {});

function shutdown() {
    provider.stop();
    process.exit(0);
}
