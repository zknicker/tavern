import type { SortableSessionLogEntry } from './entry-shared.ts';
import { getTimestampValue } from './entry-shared.ts';

export function sortSessionLogEntries(entries: SortableSessionLogEntry[]) {
    return entries.sort((left, right) => {
        const timeDifference =
            getTimestampValue(left.timestamp) - getTimestampValue(right.timestamp);

        if (timeDifference !== 0) {
            return timeDifference;
        }

        if (left.kind === right.kind) {
            return left.order - right.order;
        }

        if (left.kind === 'message') {
            return -1;
        }

        if (right.kind === 'message') {
            return 1;
        }

        if (left.kind === 'toolExecution') {
            return -1;
        }

        if (right.kind === 'toolExecution') {
            return 1;
        }

        return 1;
    });
}
