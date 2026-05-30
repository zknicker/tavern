import { spawn } from 'node:child_process';

let updateStartedAt: string | null = null;

function clearStartedUpdate(startedAt: string) {
    if (updateStartedAt === startedAt) {
        updateStartedAt = null;
    }
}

export function startRuntimeUpdate() {
    const isAlreadyStarted = Boolean(updateStartedAt);
    const startedAt = updateStartedAt ?? new Date().toISOString();
    updateStartedAt = startedAt;

    if (!isAlreadyStarted) {
        const child = spawn(
            'sh',
            [
                '-lc',
                'brew update && brew upgrade tavern-runtime && brew services restart tavern-runtime',
            ],
            {
                detached: true,
                env: process.env,
                stdio: 'ignore',
            }
        );
        child.once('error', () => {
            clearStartedUpdate(startedAt);
        });
        child.once('exit', (code) => {
            if (code !== 0) {
                clearStartedUpdate(startedAt);
            }
        });
        child.unref();
    }

    return {
        accepted: true,
        message: 'Runtime update started.',
        startedAt,
    };
}
