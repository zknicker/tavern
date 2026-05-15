export type OpenClawHarness = 'codex' | 'pi';
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
    harness: OpenClawHarness;
    modelId: string | null;
    openClawModelNameId: string | null;
    thinkingDefault: ThinkingLevelValue | null;
}

export interface AgentSettingsDraft {
    model: AgentModelDraft | null;
    profile: AgentProfileDraft;
}
