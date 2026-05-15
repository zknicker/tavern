export interface OpenClawConfigFixupContext {
    runtimeId: string;
}

export interface OpenClawConfigFixupResult {
    changed: boolean;
    config: Record<string, unknown>;
    message: string | null;
}

export interface OpenClawConfigFixup {
    apply: (input: {
        config: Record<string, unknown>;
        context: OpenClawConfigFixupContext;
    }) => Promise<OpenClawConfigFixupResult>;
    id: string;
    label: string;
}

export interface AppliedOpenClawConfigFixup {
    id: string;
    label: string;
    message: string | null;
}
