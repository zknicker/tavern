export const memoryTabs = [
    {
        description: 'Append-only memory events and audit history will land here first.',
        emptyState:
            'No activity events are available yet. Phase 1 adds the activity log and its first inspection view.',
        title: 'Activity',
        value: 'activity',
    },
    {
        description: 'The prompt-facing memory context and bulletin output will appear here.',
        emptyState:
            'No bulletin has been built yet. Later phases add working memory, bulletin assembly, and refresh timestamps.',
        title: 'Bulletin',
        value: 'bulletin',
    },
    {
        description:
            'Durable memory records, retrieval details, and lifecycle state will appear here.',
        emptyState:
            'No durable memories exist yet. Durable storage, capture output, and retrieval diagnostics land in later phases.',
        title: 'Durable',
        value: 'durable',
    },
] as const;

export type MemoryTabId = (typeof memoryTabs)[number]['value'];
