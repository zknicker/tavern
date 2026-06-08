import type { HermesSseEvent } from './protocol';

export async function* parseSse(
    stream: ReadableStream<Uint8Array>
): AsyncGenerator<HermesSseEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/u);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
            const parsed = parseSsePart(part);
            if (parsed) {
                yield parsed;
            }
        }
    }

    const tail = parseSsePart(buffer);
    if (tail) {
        yield tail;
    }
}

function parseSsePart(part: string): HermesSseEvent | null {
    if (!part.trim()) {
        return null;
    }

    let event = 'message';
    const data: string[] = [];
    for (const line of part.split(/\r?\n/u)) {
        if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
        }
        if (line.startsWith('data:')) {
            data.push(line.slice('data:'.length).trimStart());
        }
    }
    if (data.length === 0) {
        return { data: {}, event };
    }

    try {
        const parsed = JSON.parse(data.join('\n')) as unknown;
        return { data: asRecord(parsed), event };
    } catch {
        return { data: { text: data.join('\n') }, event };
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
