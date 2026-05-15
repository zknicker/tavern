import { OpenClawGatewayError } from './errors.ts';
import { openClawChallengeEventSchema } from './schemas.ts';

const openClawChallengeTimeoutMs = 3000;

interface WaitForOpenInput {
    hasDevice: boolean;
    socket: WebSocket;
    timeoutMs: number;
}

export async function waitForOpenOrChallenge(input: WaitForOpenInput) {
    return await new Promise<string | null>((resolve, reject) => {
        let challengeTimeout: ReturnType<typeof setTimeout> | null = null;
        const timeout = setTimeout(() => {
            cleanup();
            reject(
                new OpenClawGatewayError({
                    code: 'openclaw_gateway_connect_timeout',
                    message: 'Timed out connecting to OpenClaw Gateway.',
                    retryable: true,
                })
            );
        }, input.timeoutMs);

        const cleanup = () => {
            clearTimeout(timeout);
            if (challengeTimeout) {
                clearTimeout(challengeTimeout);
                challengeTimeout = null;
            }
            input.socket.removeEventListener('open', onOpen);
            input.socket.removeEventListener('message', onMessage);
            input.socket.removeEventListener('close', onClose);
            input.socket.removeEventListener('error', onError);
        };

        const onOpen = () => {
            challengeTimeout = setTimeout(() => {
                cleanup();

                if (input.hasDevice) {
                    reject(
                        new OpenClawGatewayError({
                            code: 'openclaw_gateway_challenge_missing',
                            message: 'OpenClaw Gateway did not send connect.challenge.',
                            retryable: true,
                        })
                    );
                    return;
                }

                resolve(null);
            }, openClawChallengeTimeoutMs);
        };

        const onError = () => {
            cleanup();
            reject(
                new OpenClawGatewayError({
                    code: 'openclaw_gateway_connect_failed',
                    message: 'Failed to connect to OpenClaw Gateway.',
                    retryable: true,
                })
            );
        };

        const onClose = () => {
            cleanup();
            reject(
                new OpenClawGatewayError({
                    code: 'openclaw_gateway_closed',
                    message: 'OpenClaw Gateway connection closed.',
                    retryable: true,
                })
            );
        };

        const onMessage = (event: MessageEvent) => {
            const parsed = openClawChallengeEventSchema.safeParse(parseJson(event.data));

            if (!parsed.success) {
                return;
            }

            cleanup();
            resolve(parsed.data.payload.nonce);
        };

        input.socket.addEventListener('open', onOpen);
        input.socket.addEventListener('message', onMessage);
        input.socket.addEventListener('close', onClose);
        input.socket.addEventListener('error', onError);
    });
}

function parseJson(value: unknown) {
    try {
        return JSON.parse(String(value)) as unknown;
    } catch {
        return null;
    }
}
