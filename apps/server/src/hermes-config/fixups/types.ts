export interface HermesConfigFixupContext {
    runtimeId: string;
}

export interface HermesConfigFixupResult {
    changed: boolean;
    config: Record<string, unknown>;
    message: string | null;
}

export interface HermesConfigFixup {
    apply: (input: {
        config: Record<string, unknown>;
        context: HermesConfigFixupContext;
    }) => Promise<HermesConfigFixupResult>;
    id: string;
    label: string;
}

export interface AppliedHermesConfigFixup {
    id: string;
    label: string;
    message: string | null;
}
