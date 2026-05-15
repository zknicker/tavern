export type WindowNavigationType = 'POP' | 'PUSH' | 'REPLACE';

export interface WindowNavigationHistoryState {
    entries: string[];
    index: number;
}

interface WindowNavigationHistoryChange {
    key: string;
    navigationType: WindowNavigationType;
}

export function createWindowNavigationHistoryState(
    initialKey: string
): WindowNavigationHistoryState {
    return {
        entries: [initialKey],
        index: 0,
    };
}

export function applyWindowNavigationHistoryChange(
    state: WindowNavigationHistoryState,
    change: WindowNavigationHistoryChange
): WindowNavigationHistoryState {
    const currentKey = state.entries[state.index];

    if (currentKey === change.key) {
        return state;
    }

    if (change.navigationType === 'REPLACE') {
        const entries = [...state.entries];
        entries[state.index] = change.key;
        return {
            entries,
            index: state.index,
        };
    }

    if (change.navigationType === 'POP') {
        const nextIndex = state.entries.indexOf(change.key);

        if (nextIndex >= 0) {
            return {
                entries: state.entries,
                index: nextIndex,
            };
        }
    }

    return {
        entries: [...state.entries.slice(0, state.index + 1), change.key],
        index: state.index + 1,
    };
}
