import fs from 'node:fs/promises';
import path from 'node:path';

const logEntryPattern = /^## \[(?<date>\d{4}-\d{2}-\d{2})[^\]]*\] (?<op>[a-z-]+) \|(?<rest>.*)$/u;

export interface WikiLogEntry {
    date: string;
    op: string;
    rest: string;
}

/**
 * Parses a topic's `log.md` — the append-only activity log, one
 * `## [YYYY-MM-DD] op | detail` line per operation. File order is
 * chronological, so callers can rely on position as a tiebreaker.
 */
export function parseWikiLogEntries(content: string): WikiLogEntry[] {
    return content
        .split('\n')
        .map((line) => logEntryPattern.exec(line)?.groups)
        .filter((groups): groups is { date: string; op: string; rest: string } => Boolean(groups))
        .map((groups) => ({ date: groups.date, op: groups.op, rest: groups.rest.trim() }));
}

export async function readWikiLogEntries(topicPath: string): Promise<WikiLogEntry[]> {
    try {
        return parseWikiLogEntries(await fs.readFile(path.join(topicPath, 'log.md'), 'utf8'));
    } catch {
        return [];
    }
}
