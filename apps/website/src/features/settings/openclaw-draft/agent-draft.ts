import type { AgentListOutput, ModelListOutput } from '../../../lib/trpc.tsx';
import { useOpenClawSettingsDraft } from './provider.tsx';
import type { AgentModelDraft, AgentSettingsDraft, ThinkingLevelValue } from './types.ts';

const thinkingLevels = new Set<ThinkingLevelValue>([
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'adaptive',
    'max',
]);

type OpenClawConfig = Record<string, unknown>;
type AgentDraftUpdater = (draft: AgentSettingsDraft) => AgentSettingsDraft;

export function useOpenClawAgentDraft(input: {
    agent: AgentListOutput['agents'][number];
    baseline: AgentSettingsDraft;
    modelOptions: ModelListOutput['models'];
}) {
    const context = useOpenClawSettingsDraft();
    const draft = readAgentDraft({
        agent: input.agent,
        baseline: input.baseline,
        config: context.config,
        modelOptions: input.modelOptions,
    });

    return {
        draft,
        update: (updater: AgentDraftUpdater) => {
            context.updateConfig((config) =>
                writeAgentDraft(config, {
                    agent: input.agent,
                    draft: updater(draft),
                    modelOptions: input.modelOptions,
                })
            );
        },
    };
}

export function readOpenClawAgentConfigEntry(config: OpenClawConfig | null, agentId: string) {
    return findAgentEntry(config, agentId);
}

function readAgentDraft(input: {
    agent: AgentListOutput['agents'][number];
    baseline: AgentSettingsDraft;
    config: OpenClawConfig | null;
    modelOptions: ModelListOutput['models'];
}): AgentSettingsDraft {
    const entry = findAgentEntry(input.config, input.agent.id);
    const model = readAgentModelDraft(entry, input.baseline.model, input.modelOptions);

    return {
        model: model
            ? {
                  ...model,
                  thinkingDefault:
                      readThinkingDefault(entry?.thinkingDefault) ??
                      input.baseline.model?.thinkingDefault ??
                      null,
              }
            : null,
        profile: {
            defaultPrimaryColor: input.baseline.profile.defaultPrimaryColor,
            displayName: readString(entry?.name) ?? input.baseline.profile.displayName,
            primaryColor:
                readString(entry?.primaryColor) ??
                readString(entry?.color) ??
                input.baseline.profile.primaryColor,
        },
    };
}

function writeAgentDraft(
    config: OpenClawConfig,
    input: {
        agent: AgentListOutput['agents'][number];
        draft: AgentSettingsDraft;
        modelOptions: ModelListOutput['models'];
    }
) {
    const agents = readRecord(config.agents);
    const list = readRecordArray(agents.list);
    const existing = list.find((entry) => readString(entry.id) === input.agent.id);
    const selected = findOpenClawModelName(input.draft.model, input.modelOptions);
    const existingConfig = omitTavernAgentPresentationKeys(existing ?? {});
    const {
        agentRuntime: _legacyAgentRuntime,
        embeddedHarness: _legacyEmbeddedHarness,
        thinkingDefault: _thinkingDefault,
        ...currentConfig
    } = existingConfig;
    const selectedModelRef = selected ? `${selected.provider}/${selected.model}` : null;
    const models = readRecord(currentConfig.models);
    const selectedModelConfig = selectedModelRef ? readRecord(models[selectedModelRef]) : {};
    const nextEntry = {
        ...currentConfig,
        id: input.agent.id,
        name: input.draft.profile.displayName,
        ...(input.draft.model?.thinkingDefault
            ? { thinkingDefault: input.draft.model.thinkingDefault }
            : {}),
        ...(selected && selectedModelRef
            ? {
                  model: {
                      ...readRecord(currentConfig.model),
                      fallbacks: [],
                      primary: selectedModelRef,
                  },
                  models: {
                      ...models,
                      [selectedModelRef]: {
                          ...selectedModelConfig,
                          agentRuntime: {
                              ...readRecord(selectedModelConfig.agentRuntime),
                              id: selected.harness,
                          },
                      },
                  },
              }
            : {}),
    };

    return {
        ...config,
        agents: {
            ...agents,
            list: existing
                ? list.map((entry) => (readString(entry.id) === input.agent.id ? nextEntry : entry))
                : [...list, nextEntry],
        },
    };
}

function readAgentModelDraft(
    entry: Record<string, unknown> | null,
    fallback: AgentModelDraft | null,
    modelOptions: ModelListOutput['models']
) {
    const primary = readPrimaryModelRef(entry?.model);
    const harness = primary
        ? readString(readRecord(readRecord(readRecord(entry?.models)[primary]).agentRuntime).id)
        : null;

    if (!(harness && primary)) {
        return fallback;
    }

    for (const model of modelOptions) {
        const name = model.openClawNames?.find(
            (candidate) =>
                candidate.harness === harness &&
                `${candidate.provider}/${candidate.model}` === primary
        );

        if (name) {
            return {
                harness: name.harness,
                modelId: model.id,
                openClawModelNameId: name.id,
                thinkingDefault: fallback?.thinkingDefault ?? null,
            };
        }
    }

    return fallback;
}

function findOpenClawModelName(
    draft: AgentModelDraft | null,
    modelOptions: ModelListOutput['models']
) {
    if (!draft?.openClawModelNameId) {
        return null;
    }

    return (
        modelOptions
            .flatMap((model) => model.openClawNames ?? [])
            .find((name) => name.id === draft.openClawModelNameId) ?? null
    );
}

function findAgentEntry(config: OpenClawConfig | null, agentId: string) {
    const list = readRecordArray(readRecord(config?.agents).list);
    return list.find((entry) => readString(entry.id) === agentId) ?? null;
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readPrimaryModelRef(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }

    return readString(readRecord(value).primary);
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readThinkingDefault(value: unknown) {
    const stringValue = readString(value);
    return stringValue && thinkingLevels.has(stringValue as ThinkingLevelValue)
        ? (stringValue as ThinkingLevelValue)
        : null;
}

function omitTavernAgentPresentationKeys(entry: Record<string, unknown>) {
    const { color: _color, primaryColor: _primaryColor, ...config } = entry;
    return config;
}
