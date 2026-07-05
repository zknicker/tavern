export interface SkillCuratorActions {
    consolidations: Array<{ from: string; into: string; reason: string }>;
    creates: Array<{ skillId: string }>;
    patches: Array<{ path?: string; skillId: string }>;
    prunings: Array<{ name: string; reason: string }>;
    writes: Array<{ path?: string; skillId: string }>;
}

interface CuratorTranscriptSource {
    text: string;
    toolCalls: Array<{ input: unknown; toolCallId: string; toolName: string }>;
    toolResults: Array<{ output: unknown; toolCallId: string; toolName: string }>;
}

export function serializeCuratorTranscript(result: CuratorTranscriptSource) {
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

export function collectCuratorActions(transcript: ReturnType<typeof serializeCuratorTranscript>) {
    const actions: SkillCuratorActions = {
        consolidations: [],
        creates: [],
        patches: [],
        prunings: [],
        writes: [],
    };
    for (const result of transcript.toolResults) {
        const output = unwrapToolOutput(result.output);
        const change = output?.change as { path?: string; skillId?: string } | undefined;
        const skill = output?.skill as { id?: string } | undefined;
        const archive = output?.archive as
            | { absorbedInto?: string | null; reason?: string; skillId?: string }
            | undefined;
        if (result.toolName === 'skill_patch' && change?.skillId) {
            actions.patches.push({ path: change.path, skillId: change.skillId });
        } else if (result.toolName === 'skill_write_file' && change?.skillId) {
            actions.writes.push({ path: change.path, skillId: change.skillId });
        } else if (result.toolName === 'skill_create' && skill?.id) {
            actions.creates.push({ skillId: skill.id });
        } else if (result.toolName === 'skill_archive' && archive?.skillId && archive.reason) {
            recordArchiveAction(actions, archive);
        }
    }
    return actions;
}

export function fileChangesFromCuratorActions(actions: SkillCuratorActions) {
    return [
        ...actions.patches.map((action) => ({
            afterHash: null,
            beforeHash: null,
            path: `${action.skillId}/${action.path ?? 'SKILL.md'}`,
        })),
        ...actions.writes.map((action) => ({
            afterHash: null,
            beforeHash: null,
            path: `${action.skillId}/${action.path ?? 'SKILL.md'}`,
        })),
        ...actions.creates.map((action) => ({
            afterHash: null,
            beforeHash: null,
            path: `${action.skillId}/SKILL.md`,
        })),
    ];
}

function recordArchiveAction(
    actions: SkillCuratorActions,
    archive: { absorbedInto?: string | null; reason: string; skillId: string }
) {
    if (archive.absorbedInto) {
        actions.consolidations.push({
            from: archive.skillId,
            into: archive.absorbedInto,
            reason: archive.reason,
        });
    } else {
        actions.prunings.push({ name: archive.skillId, reason: archive.reason });
    }
}

function unwrapToolOutput(output: unknown): Record<string, unknown> | null {
    const wrapped = output as { ok?: unknown; output?: unknown };
    const value = wrapped?.ok === true ? wrapped.output : output;
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
