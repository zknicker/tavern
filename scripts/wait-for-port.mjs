import net from 'node:net';

function parsePort(value) {
    if (!(value && /^\d+$/u.test(value))) {
        throw new Error(`Expected a valid port, received "${value ?? ''}".`);
    }

    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65_535) {
        throw new Error(`Expected a valid port, received "${value}".`);
    }

    return numericValue;
}

function sleep(durationMs) {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function waitForPort({ host, port, timeoutMs }) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const isOpen = await new Promise((resolve) => {
            const socket = net.connect({ host, port });

            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.once('error', () => {
                socket.destroy();
                resolve(false);
            });
        });

        if (isOpen) {
            return;
        }

        await sleep(100);
    }

    throw new Error(`Timed out waiting for ${host}:${port}.`);
}

async function main() {
    const port = parsePort(process.argv[2]);
    const host = process.argv[3] ?? '127.0.0.1';
    const timeoutMs = process.argv[4] ? Number(process.argv[4]) : 30_000;

    await waitForPort({ host, port, timeoutMs });
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
