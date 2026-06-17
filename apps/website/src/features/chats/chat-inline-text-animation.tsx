import type * as React from 'react';

export interface ChatTextAnimationRange {
    end: number;
    id: string;
    start: number;
}

export function renderTextWithAnimatedRanges(
    text: string,
    sourceStart: number,
    keyPrefix: string,
    ranges: readonly ChatTextAnimationRange[]
) {
    const overlaps = ranges
        .filter((range) => range.end > sourceStart && range.start < sourceStart + text.length)
        .sort((left, right) => left.start - right.start);

    if (overlaps.length === 0) {
        return [text];
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (const range of overlaps) {
        const start = Math.max(cursor, range.start - sourceStart);
        const end = Math.min(text.length, range.end - sourceStart);

        if (start > cursor) {
            nodes.push(text.slice(cursor, start));
        }

        if (end > start) {
            nodes.push(
                <span
                    className="chat-streaming-text-chunk"
                    key={`${keyPrefix}:stream:${range.id}:${start}`}
                >
                    {renderStreamingTextUnits(
                        text.slice(start, end),
                        `${keyPrefix}:stream:${range.id}:${start}`
                    )}
                </span>
            );
        }

        cursor = end;
    }

    if (cursor < text.length) {
        nodes.push(text.slice(cursor));
    }

    return nodes;
}

function renderStreamingTextUnits(text: string, keyPrefix: string) {
    return splitStreamingTextUnits(text).map((unit) => {
        if (/^\s+$/u.test(unit.text)) {
            return unit.text;
        }

        return (
            <span
                className="chat-streaming-text-unit"
                key={`${keyPrefix}:unit:${unit.start}`}
                style={{ animationDelay: `${Math.min(unit.start * 16, 140)}ms` }}
            >
                {unit.text}
            </span>
        );
    });
}

function splitStreamingTextUnits(text: string) {
    return Array.from(text.matchAll(/\s+|\S+/gu), (match) => ({
        start: match.index ?? 0,
        text: match[0],
    }));
}
