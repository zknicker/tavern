export type ThinkingLevelValue =
    | 'off'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'adaptive'
    | 'max';

export interface AgentModelDraft {
    modelRef: string | null;
    thinkingDefault: ThinkingLevelValue | null;
}
