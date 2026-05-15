import * as React from 'react';
import { useOpenClawConfig } from '../../../hooks/openclaw-config/use-openclaw-config.ts';
import { useOpenClawConfigApply } from '../../../hooks/openclaw-config/use-openclaw-config-apply.ts';
import { validateOpenClawConfigDraft } from './openclaw-config-validation.ts';

type OpenClawConfig = Record<string, unknown>;
type ConfigUpdater = (config: OpenClawConfig) => OpenClawConfig;

interface DraftState {
    baseHash: string;
    baseline: OpenClawConfig;
    draft: OpenClawConfig;
    remoteHash: string | null;
    runtimeId: string;
}

interface OpenClawSettingsDraftContextValue {
    baseHash: string | null;
    config: OpenClawConfig | null;
    errorMessage: string | null;
    hasChanges: boolean;
    isLoading: boolean;
    isSaving: boolean;
    resetAll: () => void;
    runtimeId: string | null;
    saveAll: () => Promise<boolean>;
    updateConfig: (updater: ConfigUpdater) => void;
    validationMessage: string | null;
}

const OpenClawSettingsDraftContext = React.createContext<OpenClawSettingsDraftContextValue | null>(
    null
);

export function OpenClawSettingsDraftProvider({ children }: { children: React.ReactNode }) {
    const configQuery = useOpenClawConfig();
    const applyMutation = useOpenClawConfigApply();
    const [state, setState] = React.useState<DraftState | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const snapshot = configQuery.data?.snapshot ?? null;

    React.useEffect(() => {
        setState((current) => {
            if (!snapshot) {
                return current && isDraftStateDirty(current) ? current : null;
            }

            if (current && isDraftStateDirty(current)) {
                if (
                    current.runtimeId === snapshot.runtimeId &&
                    current.baseHash !== snapshot.hash
                ) {
                    return {
                        ...current,
                        remoteHash: snapshot.hash,
                    };
                }

                return current;
            }

            const nextConfig = cloneConfig(snapshot.config);
            return {
                baseHash: snapshot.hash,
                baseline: nextConfig,
                draft: cloneConfig(nextConfig),
                remoteHash: null,
                runtimeId: snapshot.runtimeId,
            };
        });
        setErrorMessage(null);
    }, [snapshot]);

    const hasChanges = state ? isDraftStateDirty(state) : false;
    const validationMessage = React.useMemo(() => {
        if (!(state && hasChanges)) {
            return null;
        }

        if (state.remoteHash) {
            return 'Runtime config changed since this draft was created. Discard and reload before saving.';
        }

        return validateOpenClawConfigDraft(state.draft);
    }, [hasChanges, state]);

    const updateConfig = React.useCallback((updater: ConfigUpdater) => {
        setState((current) =>
            current
                ? {
                      ...current,
                      draft: updater(cloneConfig(current.draft)),
                  }
                : current
        );
        setErrorMessage(null);
    }, []);

    const resetAll = React.useCallback(() => {
        setState((current) =>
            current
                ? {
                      ...current,
                      draft: cloneConfig(current.baseline),
                      remoteHash: null,
                  }
                : current
        );
        setErrorMessage(null);
    }, []);

    const saveAll = React.useCallback(async () => {
        if (!(state && hasChanges)) {
            return true;
        }

        if (validationMessage) {
            setErrorMessage(validationMessage);
            return false;
        }

        setIsSaving(true);
        setErrorMessage(null);

        try {
            const result = await applyMutation.mutateAsync({
                baseHash: state.baseHash,
                config: state.draft,
                runtimeId: state.runtimeId,
            });
            const nextSnapshot = result.snapshot;

            if (nextSnapshot) {
                const nextConfig = cloneConfig(nextSnapshot.config);
                setState({
                    baseHash: nextSnapshot.hash,
                    baseline: nextConfig,
                    draft: cloneConfig(nextConfig),
                    remoteHash: null,
                    runtimeId: nextSnapshot.runtimeId,
                });
            }

            return true;
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings.');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [applyMutation.mutateAsync, hasChanges, state, validationMessage]);

    const value = React.useMemo<OpenClawSettingsDraftContextValue>(
        () => ({
            baseHash: state?.baseHash ?? null,
            config: state?.draft ?? null,
            errorMessage,
            hasChanges,
            isLoading: configQuery.isPending,
            isSaving,
            resetAll,
            runtimeId: state?.runtimeId ?? null,
            saveAll,
            updateConfig,
            validationMessage,
        }),
        [
            configQuery.isPending,
            errorMessage,
            hasChanges,
            isSaving,
            resetAll,
            saveAll,
            state,
            updateConfig,
            validationMessage,
        ]
    );

    return (
        <OpenClawSettingsDraftContext.Provider value={value}>
            {children}
        </OpenClawSettingsDraftContext.Provider>
    );
}

export function useOpenClawSettingsDraft() {
    const context = React.useContext(OpenClawSettingsDraftContext);

    if (!context) {
        throw new Error(
            'useOpenClawSettingsDraft must be used inside OpenClawSettingsDraftProvider'
        );
    }

    return context;
}

function isDraftStateDirty(state: DraftState) {
    return toStableJson(state.baseline) !== toStableJson(state.draft);
}

function cloneConfig(config: OpenClawConfig): OpenClawConfig {
    return JSON.parse(JSON.stringify(config)) as OpenClawConfig;
}

function toStableJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(toStableJson).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => `${JSON.stringify(key)}:${toStableJson(entry)}`)
            .join(',')}}`;
    }

    return JSON.stringify(value);
}
