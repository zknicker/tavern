const SCRIPT_TIMEOUT_MS = 60_000;
const SCRIPT_OUTPUT_CAP = 16_384;

export interface ReminderScriptResult {
    exitCode: number;
    stderr: string;
    stdout: string;
}

export type ReminderScriptRunner = (input: {
    cwd: string;
    script: string;
}) => Promise<ReminderScriptResult>;

export async function runReminderScript(input: {
    cwd: string;
    script: string;
}): Promise<ReminderScriptResult> {
    const child = Bun.spawn(['/bin/zsh', '-lc', input.script], {
        cwd: input.cwd,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const timeout = setTimeout(() => child.kill(), SCRIPT_TIMEOUT_MS);
    try {
        const [stdout, stderr, exitCode] = await Promise.all([
            readBoundedText(child.stdout),
            readBoundedText(child.stderr),
            child.exited,
        ]);
        return { exitCode, stderr, stdout };
    } finally {
        clearTimeout(timeout);
    }
}

export function boundScriptText(value: string): string {
    const bytes = Buffer.from(value);
    return decodeBounded(
        bytes.subarray(0, SCRIPT_OUTPUT_CAP),
        bytes.byteLength > SCRIPT_OUTPUT_CAP
    );
}

async function readBoundedText(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let retained = 0;
    let truncated = false;
    while (true) {
        const next = await reader.read();
        if (next.done) {
            break;
        }
        const remaining = SCRIPT_OUTPUT_CAP - retained;
        if (remaining > 0) {
            const chunk = next.value.subarray(0, remaining);
            chunks.push(chunk);
            retained += chunk.byteLength;
        }
        truncated ||= next.value.byteLength > remaining;
    }
    const bytes = Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk)),
        retained
    );
    return decodeBounded(bytes, truncated);
}

function decodeBounded(bytes: Uint8Array, truncated: boolean): string {
    if (!truncated) {
        return truncateUtf8Text(new TextDecoder().decode(bytes), SCRIPT_OUTPUT_CAP);
    }
    const marker = '\n[truncated]';
    const visibleLimit = SCRIPT_OUTPUT_CAP - Buffer.byteLength(marker);
    const visible = new TextDecoder().decode(bytes.subarray(0, visibleLimit), { stream: true });
    const output = `${truncateUtf8Text(visible, visibleLimit)}${marker}`;
    if (Buffer.byteLength(output) > SCRIPT_OUTPUT_CAP) {
        throw new Error('Reminder script output exceeded its byte cap.');
    }
    return output;
}

function truncateUtf8Text(value: string, maxBytes: number) {
    const bytes = Buffer.from(value);
    let end = Math.min(bytes.byteLength, maxBytes);
    while (end < bytes.byteLength && end > 0 && (bytes[end] & 0xc0) === 0x80) {
        end -= 1;
    }
    return bytes.subarray(0, end).toString();
}
