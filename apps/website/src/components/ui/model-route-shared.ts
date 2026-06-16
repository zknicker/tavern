import { formatModelOptionLabel } from '../../lib/model-provider-config.ts';
import type { ModelListOutput } from '../../lib/trpc.tsx';

export interface ModelOptionItem {
    availability: 'available' | 'configured';
    label: string;
    provider: string;
    value: string;
}

export function buildRoute(primaryModel: string | null, fallbackModels: string[]) {
    return [primaryModel, ...fallbackModels].filter((entry): entry is string => Boolean(entry));
}

export function splitRoute(route: string[]) {
    return {
        fallbackModels: route.slice(1),
        primaryModel: route[0] ?? null,
    };
}

function parseAgentRuntimeModelRef(value: string) {
    const separatorIndex = value.indexOf('/');

    return {
        modelId: value.slice(separatorIndex + 1).trim(),
        provider: value.slice(0, separatorIndex).trim(),
    };
}

export function parseModelRef(value: string) {
    const parsed = parseAgentRuntimeModelRef(value);

    return {
        modelId: parsed.modelId,
        providerId: parsed.provider,
    };
}

export function createModelOption(value: string) {
    const parsed = parseModelRef(value);

    return {
        availability: 'configured',
        label: formatModelOptionLabel({
            modelId: parsed.modelId,
            providerId: parsed.providerId,
        }),
        provider: parsed.providerId,
        value,
    } satisfies ModelOptionItem;
}

function buildIncludedModelRefs(data: ModelListOutput | undefined) {
    const refs = new Set<string>();

    for (const modelRef of buildRoute(
        data?.defaults.primaryModel ?? null,
        data?.defaults.fallbackModels ?? []
    )) {
        refs.add(modelRef);
    }

    if (data?.subAgentDefaultModel) {
        refs.add(data.subAgentDefaultModel);
    }

    for (const agent of data?.agents ?? []) {
        for (const modelRef of buildRoute(
            agent.effective.primaryModel,
            agent.effective.fallbackModels
        )) {
            refs.add(modelRef);
        }

        if (agent.subAgentModel) {
            refs.add(agent.subAgentModel);
        }
    }

    return refs;
}

function buildModelOptionItems(
    data: ModelListOutput | undefined,
    includeModel: (model: ModelListOutput['models'][number]) => boolean,
    includeModelRef: (modelRef: string) => boolean = () => true
) {
    const items = new Map<string, ModelOptionItem>();

    for (const model of data?.models ?? []) {
        if (!includeModel(model)) {
            continue;
        }

        const value = model.ref;
        items.set(value, {
            availability: model.availability,
            label: formatModelOptionLabel({
                fallbackName: model.name,
                modelId: model.modelId,
                providerId: model.provider,
            }),
            provider: model.provider,
            value,
        });
    }

    for (const modelRef of buildIncludedModelRefs(data)) {
        if (includeModelRef(modelRef) && !items.has(modelRef)) {
            items.set(modelRef, createModelOption(modelRef));
        }
    }

    const nextItems = [...items.values()];
    const labelCounts = new Map<string, number>();

    for (const item of nextItems) {
        labelCounts.set(item.label, (labelCounts.get(item.label) ?? 0) + 1);
    }

    return nextItems
        .map((item) =>
            (labelCounts.get(item.label) ?? 0) > 1
                ? {
                      ...item,
                      label: `${item.label} · ${item.value}`,
                  }
                : item
        )
        .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildModelOptions(data: ModelListOutput | undefined): ModelOptionItem[] {
    return buildModelOptionItems(data, () => true);
}

export function buildConfiguredModelOptions(data: ModelListOutput | undefined): ModelOptionItem[] {
    return buildModelOptionItems(data, (model) => model.availability === 'configured');
}

export function buildChatRoutingConfiguredModelOptions(
    data: ModelListOutput | undefined
): ModelOptionItem[] {
    return buildModelOptionItems(
        data,
        (model) => model.availability === 'configured' && model.supportsChatRouting,
        (modelRef) =>
            Boolean(data?.models.find((model) => model.ref === modelRef)?.supportsChatRouting)
    );
}

export function buildChatRoutingModelOptions(data: ModelListOutput | undefined): ModelOptionItem[] {
    return buildModelOptionItems(
        data,
        (model) => model.supportsChatRouting,
        (modelRef) =>
            Boolean(data?.models.find((model) => model.ref === modelRef)?.supportsChatRouting)
    );
}
