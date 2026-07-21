import type { ModelListOutput } from '../../../lib/trpc.tsx';
import type { AgentModelDraft } from './types.ts';

export function createAgentModelBaseline(
    modelSetting: ModelListOutput['agents'][number] | undefined
): AgentModelDraft | null {
    return modelSetting
        ? {
              modelRef: modelSetting.modelRef,
              thinkingDefault: modelSetting.overrideThinkingDefault,
          }
        : null;
}

export async function saveAgentModel(input: {
    current: AgentModelDraft | null;
    model: AgentModelDraft | null;
    updateModel: (modelRef: string) => Promise<unknown>;
    updateThinkingDefault: (
        thinkingDefault: AgentModelDraft['thinkingDefault']
    ) => Promise<unknown>;
}) {
    const jobs: Promise<unknown>[] = [];

    if (input.model?.modelRef && input.model.modelRef !== input.current?.modelRef) {
        jobs.push(input.updateModel(input.model.modelRef));
    }
    if (input.model?.thinkingDefault !== input.current?.thinkingDefault) {
        jobs.push(input.updateThinkingDefault(input.model?.thinkingDefault ?? null));
    }

    await Promise.all(jobs);
}
