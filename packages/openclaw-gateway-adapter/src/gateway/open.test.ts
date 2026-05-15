import { expect, test } from 'bun:test';
import { OpenClawGatewayError } from './errors.ts';
import { waitForOpenOrChallenge } from './open.ts';

test('waitForOpenOrChallenge rejects immediately when the socket closes during handshake', async () => {
    const socket = new EventTarget() as WebSocket;
    const pending = waitForOpenOrChallenge({
        hasDevice: false,
        socket,
        timeoutMs: 1000,
    });

    socket.dispatchEvent(new Event('open'));
    socket.dispatchEvent(new CloseEvent('close'));

    await expect(pending).rejects.toMatchObject({
        code: 'openclaw_gateway_closed',
        message: 'OpenClaw Gateway connection closed.',
        name: OpenClawGatewayError.name,
        retryable: true,
    });
});
