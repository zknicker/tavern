import { agentRuntimeConnectionAuthSchema } from './contracts.ts';

export function parseAgentRuntimeConnectionAuth(input: unknown) {
    if (!input) {
        return null;
    }

    let parsedJson: unknown;

    try {
        parsedJson = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
        return null;
    }

    const parsed = agentRuntimeConnectionAuthSchema.safeParse(parsedJson);

    if (!(parsed.success && parsed.data)) {
        return null;
    }

    return Object.keys(parsed.data).length > 0 ? parsed.data : null;
}
