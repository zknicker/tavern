import { hashText } from './ids';

export const cortexEncodingProvider = 'local-hash';
export const cortexEncodingModel = 'tavern-local-hash-v1';
export const cortexEncodingDimensions = 64;

export function encodeCortexText(text: string): number[] {
    const vector = Array.from({ length: cortexEncodingDimensions }, () => 0);
    const tokens = text
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter(Boolean);

    for (const token of tokens) {
        const hash = hashText(token);
        const bucket = Number.parseInt(hash.slice(0, 8), 16) % cortexEncodingDimensions;
        vector[bucket] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) {
        return vector;
    }

    return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]): number {
    const length = Math.min(left.length, right.length);
    let score = 0;
    for (let index = 0; index < length; index += 1) {
        score += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return Math.max(0, score);
}
