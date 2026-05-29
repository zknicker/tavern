import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createOpenClawGatewayClient,
    type OpenClawGatewayClient,
    type OpenClawGatewayEvent,
} from '../../../../packages/openclaw-gateway-adapter/src/index.ts';
import { createLocalOpenClawGatewayOptions } from '../../../runtime/src/openclaw/local-client.ts';

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const defaultCaptureTimeoutMs = 15_000;

export interface CapturedOpenClawGatewayEvent extends OpenClawGatewayEvent {
    capturedAt: string;
}

export interface OpenClawGatewayCapture {
    close(): void;
    events(): CapturedOpenClawGatewayEvent[];
    snapshot(label?: string): string;
    waitForEvent(
        predicate: (event: CapturedOpenClawGatewayEvent) => boolean,
        timeoutMs?: number
    ): Promise<CapturedOpenClawGatewayEvent>;
}

export async function startOpenClawGatewayCapture(
    label: string,
    options: {
        gateway?: OpenClawGatewayClient;
        runId?: string;
    } = {}
): Promise<OpenClawGatewayCapture> {
    const runId = options.runId ?? process.env.TAVERN_E2E_RUN_ID ?? 'manual';
    const captureRoot = path.join(workspaceRoot, '.context', 'openclaw-captures', runId);
    mkdirSync(captureRoot, { recursive: true });

    const gateway =
        options.gateway ?? createOpenClawGatewayClient(createLocalOpenClawGatewayOptions());
    await connectGatewayWithRetry(gateway);
    await gateway.request('sessions.subscribe', {});

    const captured: CapturedOpenClawGatewayEvent[] = [];
    const waiters = new Set<{
        predicate: (event: CapturedOpenClawGatewayEvent) => boolean;
        reject: (error: Error) => void;
        resolve: (event: CapturedOpenClawGatewayEvent) => void;
        timeout: ReturnType<typeof setTimeout>;
    }>();

    const offEvent = gateway.onEvent((event) => {
        const capturedEvent = {
            ...event,
            capturedAt: new Date().toISOString(),
        } satisfies CapturedOpenClawGatewayEvent;

        captured.push(capturedEvent);

        for (const waiter of [...waiters]) {
            if (!waiter.predicate(capturedEvent)) {
                continue;
            }

            clearTimeout(waiter.timeout);
            waiters.delete(waiter);
            waiter.resolve(capturedEvent);
        }
    });

    return {
        close() {
            offEvent();

            for (const waiter of waiters) {
                clearTimeout(waiter.timeout);
                waiter.reject(
                    new Error('OpenClaw Gateway capture closed before the event arrived.')
                );
            }

            waiters.clear();
            gateway.close();
        },
        events() {
            return [...captured];
        },
        snapshot(snapshotLabel = 'events') {
            const filePath = path.join(
                captureRoot,
                `${sanitizeLabel(label)}-${sanitizeLabel(snapshotLabel)}.json`
            );

            writeFileSync(
                filePath,
                `${JSON.stringify(
                    {
                        capturedAt: new Date().toISOString(),
                        eventCount: captured.length,
                        events: captured,
                        gatewayUrl: createLocalOpenClawGatewayOptions().gatewayUrl,
                        label,
                        runId,
                    },
                    null,
                    2
                )}\n`
            );

            return filePath;
        },
        waitForEvent(predicate, timeoutMs = defaultCaptureTimeoutMs) {
            const matched = captured.find(predicate);

            if (matched) {
                return Promise.resolve(matched);
            }

            return new Promise<CapturedOpenClawGatewayEvent>((resolve, reject) => {
                const waiter = {
                    predicate,
                    reject,
                    resolve,
                    timeout: setTimeout(() => {
                        waiters.delete(waiter);
                        reject(
                            new Error(
                                `Timed out after ${timeoutMs}ms waiting for a captured OpenClaw Gateway event.`
                            )
                        );
                    }, timeoutMs),
                };

                waiters.add(waiter);
            });
        },
    };
}

async function connectGatewayWithRetry(gateway: OpenClawGatewayClient) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            await gateway.connect();
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error('Failed to connect to OpenClaw Gateway.');
}

export function readCapturedGatewayChatId(event: OpenClawGatewayEvent) {
    const payload = asRecord(event.payload);

    return (
        readString(asRecord(payload.metadata).tavern, ['chatId']) ??
        readString(payload, ['chatId']) ??
        readTavernChatIdFromSessionKey(readString(payload, ['sessionKey'])) ??
        null
    );
}

export function readCapturedGatewayReplyText(event: OpenClawGatewayEvent) {
    const payload = asRecord(event.payload);

    const message = asRecord(payload.message);

    if (readString(message, ['text'])) {
        return readString(message, ['text']);
    }

    const content = Array.isArray(message.content) ? message.content : [];

    return content
        .map((part) => asRecord(part))
        .map((part) => (readString(part, ['type']) === 'text' ? readString(part, ['text']) : null))
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join('');
}

function sanitizeLabel(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-');
}

function asRecord(value: unknown) {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: unknown, keys: string[]) {
    let value = record;

    for (const key of keys) {
        const next = asRecord(value)[key];

        if (next === undefined) {
            return null;
        }

        value = next;
    }

    return typeof value === 'string' && value.trim() ? value : null;
}

function readTavernChatIdFromSessionKey(sessionKey: null | string) {
    const marker = ':tavern:channel:';

    if (!sessionKey?.includes(marker)) {
        return null;
    }

    return sessionKey.slice(sessionKey.lastIndexOf(marker) + marker.length) || null;
}
