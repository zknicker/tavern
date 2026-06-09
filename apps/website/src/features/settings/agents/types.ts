export type ThinkingLevelValue =
    | 'off'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'adaptive'
    | 'max';

export interface AgentProfileDraft {
    defaultPrimaryColor: string;
    displayName: string;
    primaryColor: string;
}

export interface AgentModelDraft {
    modelRef: string | null;
    thinkingDefault: ThinkingLevelValue | null;
}

export interface AgentSettingsDraft {
    model: AgentModelDraft | null;
    profile: AgentProfileDraft;
}
