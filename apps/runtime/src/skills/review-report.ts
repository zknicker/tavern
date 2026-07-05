export interface SkillReviewAction {
    path?: string;
    skillId: string;
    tool: string;
}

interface WorkerTranscript {
    text: string;
    toolCalls: Array<{ input: unknown; toolCallId: string; toolName: string }>;
    toolResults: Array<{ output: unknown; toolCallId: string; toolName: string }>;
}

export function serializeSkillReviewTranscript(result: WorkerTranscript) {
    return {
        text: result.text,
        toolCalls: result.toolCalls.map((call) => ({
            input: call.input,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
        })),
        toolResults: result.toolResults.map((toolResult) => ({
            output: toolResult.output,
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
        })),
    };
}

export function collectSkillReviewActions(
    transcript: ReturnType<typeof serializeSkillReviewTranscript>
) {
    const actions: SkillReviewAction[] = [];
    for (const result of transcript.toolResults) {
        const output = unwrapToolOutput(result.output);
        const change = output?.change as { path?: string; skillId?: string } | undefined;
        const skill = output?.skill as { id?: string } | undefined;
        if (change?.skillId) {
            actions.push({
                path: change.path,
                skillId: change.skillId,
                tool: result.toolName,
            });
        } else if (skill?.id) {
            actions.push({
                path: 'SKILL.md',
                skillId: skill.id,
                tool: result.toolName,
            });
        }
    }
    return actions;
}

export function collectSkillReviewToolErrors(
    transcript: ReturnType<typeof serializeSkillReviewTranscript>
) {
    return transcript.toolResults.flatMap((result) => {
        const output = result.output as { error?: unknown; ok?: unknown };
        return output?.ok === false && typeof output.error === 'string'
            ? [{ error: output.error, tool: result.toolName }]
            : [];
    });
}

export function fileChangesFromSkillReviewActions(actions: SkillReviewAction[]) {
    return actions.map((action) => ({
        afterHash: null,
        beforeHash: null,
        path: `${action.skillId}/${action.path ?? 'SKILL.md'}`,
    }));
}

function unwrapToolOutput(output: unknown): Record<string, unknown> | null {
    const wrapped = output as { ok?: unknown; output?: unknown };
    const value = wrapped?.ok === true ? wrapped.output : output;
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
