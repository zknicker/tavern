import runtimePackage from '../../package.json';
import type { FlowLine } from './update-flow';

/** ANSI styling, gated on TTY + NO_COLOR. All CLI output routes through here. */

const CODES = {
    reset: '[0m',
    bold: '[1m',
    dim: '[2m',
    accent: '[38;5;213m',
    yellow: '[33m',
    red: '[31m',
    green: '[32m',
} as const;

type ColorName = keyof typeof CODES;

/** True when the given stream is a TTY and NO_COLOR is unset. */
export function colorEnabled(stream: NodeJS.WriteStream = process.stdout): boolean {
    return Boolean(stream.isTTY) && !process.env.NO_COLOR;
}

function paint(text: string, color: ColorName, stream: NodeJS.WriteStream): string {
    if (!colorEnabled(stream)) {
        return text;
    }
    return `${CODES[color]}${text}${CODES.reset}`;
}

export const ui = {
    accent: (text: string, stream?: NodeJS.WriteStream) =>
        paint(text, 'accent', stream ?? process.stdout),
    bold: (text: string, stream?: NodeJS.WriteStream) =>
        paint(text, 'bold', stream ?? process.stdout),
    dim: (text: string, stream?: NodeJS.WriteStream) =>
        paint(text, 'dim', stream ?? process.stdout),
};

/**
 * Banner: name + version + one-line tagline, accent color. ≤ 6 lines including
 * the trailing blank. Compact wordmark, no figlet.
 */
export function banner(): string {
    const title = ui.accent(ui.bold('🍺 Tavern Runtime'));
    const version = ui.dim(`v${runtimePackage.version}`);
    return `${title} ${version}\n${ui.dim('The local home for your agents.')}\n`;
}

/** Section heading, bold. */
export function heading(label: string, stream: NodeJS.WriteStream = process.stdout): string {
    return ui.bold(label, stream);
}

/**
 * Two-column aligned rows. Left column padded to the widest entry so summaries
 * line up. Returns the joined block.
 */
export function rows(entries: { left: string; right: string }[], indent = '  '): string {
    const width = entries.reduce((max, entry) => Math.max(max, entry.left.length), 0);
    return entries
        .map((entry) => `${indent}${entry.left.padEnd(width)}  ${entry.right}`)
        .join('\n');
}

export type StatusTone = 'healthy' | 'degraded' | 'off';

/** Status dot: ● healthy/accent, ◐ degraded/yellow, ○ off/dim. */
export function statusDot(tone: StatusTone, stream: NodeJS.WriteStream = process.stdout): string {
    switch (tone) {
        case 'healthy':
            return paint('●', 'accent', stream);
        case 'degraded':
            return paint('◐', 'yellow', stream);
        default:
            return paint('○', 'dim', stream);
    }
}

/** Error block: `✗ message` plus an optional `  ↳ hint` line, both on stderr. */
export function errorBlock(message: string, hint?: string): string {
    const mark = paint('✗', 'red', process.stderr);
    const lines = [`${mark} ${message}`];
    if (hint) {
        lines.push(ui.dim(`  ↳ ${hint}`, process.stderr));
    }
    return lines.join('\n');
}

/** Print Phase 0 FlowLines, colorizing ✓/✗ marks when the stream is a TTY. */
export function printFlowLines(lines: FlowLine[]): void {
    for (const line of lines) {
        const stream = line.stream === 'err' ? process.stderr : process.stdout;
        const text = colorizeMarks(line.text, stream);
        if (line.stream === 'err') {
            process.stderr.write(`${text}\n`);
        } else {
            process.stdout.write(`${text}\n`);
        }
    }
}

function colorizeMarks(text: string, stream: NodeJS.WriteStream): string {
    if (!colorEnabled(stream)) {
        return text;
    }
    if (text.startsWith('✓')) {
        return text.replace('✓', paint('✓', 'green', stream));
    }
    if (text.startsWith('✗')) {
        return text.replace('✗', paint('✗', 'red', stream));
    }
    return text;
}
