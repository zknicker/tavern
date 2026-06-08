export type HermesHarness = 'codex' | 'pi';
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
    harness: HermesHarness;
    modelRef: string | null;
    thinkingDefault: ThinkingLevelValue | null;
}

export interface AgentSettingsDraft {
    model: AgentModelDraft | null;
    profile: AgentProfileDraft;
}
