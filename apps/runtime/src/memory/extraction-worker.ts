import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText } from 'ai';
import { listRuntimeSkills } from '../agent-engine/skill-library.ts';
import {
    modelCategoryModelRef,
    resolveModelCategorySelection,
} from '../models/category-settings.ts';
import {
    createLanguageModelForRuntime,
    supportsLanguageModelForRuntime,
} from '../models/language-model.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';

export interface MemoryExtractionMessage {
    author_id: string;
    content: string;
    created_at: string;
    id: string;
    role: 'assistant' | 'user';
    sequence: number;
}

export interface MemoryExtractionInput {
    agentId: string;
    chatId: string;
    jobId: string;
    messages: MemoryExtractionMessage[];
}

export interface LearningSignal {
    detail: string;
    kind: 'correction' | 'frustration' | 'skill_misfire' | 'technique';
    skillId?: string;
}

export interface MemoryExtractionOutcome {
    model: AgentRuntimeModelName;
    /** Markdown observation bullets; empty when nothing durable was found. */
    observations: string;
    signals: LearningSignal[];
    usage: unknown;
}

export type MemoryExtractionWorker = (
    input: MemoryExtractionInput
) => Promise<MemoryExtractionOutcome>;

/**
 * Backlogs are paginated into chunks so no message is ever skipped: one worker
 * call per chunk, cursor advances per chunk. A chunk closes at the character
 * budget or the message limit, whichever comes first. Content goes in
 * verbatim; only a single message larger than an entire chunk budget is
 * truncated, with an explicit marker.
 */
export const memoryExtractionChunkChars = 100_000;
export const memoryExtractionChunkMessageLimit = 200;
const noneMarker = 'NONE';

export function resolveMemoryExtractionModel() {
    const model = resolveModelCategorySelection('fast');
    if (!supportsLanguageModelForRuntime(model)) {
        throw new Error(
            `Memory extraction cannot use provider "${model.provider}" without a direct LanguageModel adapter.`
        );
    }
    return model;
}

export async function runAiSdkMemoryExtraction(
    input: MemoryExtractionInput
): Promise<MemoryExtractionOutcome> {
    const model = resolveMemoryExtractionModel();
    const result = await generateText({
        model: await createLanguageModelForRuntime(model),
        prompt: await memoryExtractionPrompt(input),
        system: memoryExtractionInstructions,
    });
    const parsed = parseMemoryExtractionText(result.text);
    return {
        model,
        observations: parsed.observations,
        signals: parsed.signals,
        usage: result.usage ?? {},
    };
}

export function memoryExtractionModelRef(model: AgentRuntimeModelName) {
    return modelCategoryModelRef(model);
}

const memoryExtractionInstructions = [
    'You are Tavern’s background episodic Memory extraction worker.',
    'You receive one settled chat transcript window. Distill it into durable observations worth remembering across sessions.',
    'Output rules:',
    '- Output only a Markdown bullet list, one observation per line, most important first.',
    '- Start each bullet with the supporting message sequence references, e.g. "- [3] ..." or "- [3,7] ...".',
    '- Record stable user preferences, decisions, commitments, corrections, and durable facts about any subject worth remembering across sessions.',
    '- Skip greetings, small talk, transient task mechanics, speculation, and anything already implied by another bullet.',
    '- Never record secrets, credentials, tokens, or private data beyond the user’s clear intent.',
    `- If nothing in the window is durable, output exactly ${noneMarker}.`,
    '',
    'After the observations (or NONE), when the window contains lessons a future',
    'session should act on, add a final section:',
    'SIGNALS',
    '- correction: <the user corrected style, format, or workflow — the gist>',
    '- frustration: <the user pushed back on how the agent worked>',
    '- technique: <a non-obvious technique, fix, or workaround worth reusing>',
    '- skill_misfire[<skill-id>]: <an enabled skill was wrong or missing a step>',
    'Only emit signal lines that clearly match; omit the SIGNALS section',
    'otherwise. Never emit signals for environment-dependent failures or for',
    'transient errors that already resolved.',
].join('\n');

async function memoryExtractionPrompt(input: MemoryExtractionInput) {
    const skills = await listEnabledSkills(input.agentId);
    return [
        'Enabled skills:',
        skills.length === 0
            ? 'NONE'
            : skills.map((skill) => `- ${skill.id}: ${skill.name}`).join('\n'),
        '',
        'Transcript window:',
        '',
        renderExtractionTranscript(input.messages),
    ].join('\n');
}

export function renderExtractionTranscript(messages: MemoryExtractionMessage[]) {
    return messages
        .map(
            (message) =>
                `[${message.sequence}] ${message.role} (${message.author_id}, ${message.created_at}):\n${boundedContent(message.content)}`
        )
        .join('\n\n');
}

function boundedContent(content: string) {
    const trimmed = content.trimEnd();
    if (trimmed.length <= memoryExtractionChunkChars) {
        return trimmed;
    }
    const omitted = trimmed.length - memoryExtractionChunkChars;
    return `${trimmed.slice(0, memoryExtractionChunkChars)}\n[message truncated: ${omitted} characters omitted]`;
}

function normalizeObservations(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.toUpperCase() === noneMarker) {
        return '';
    }
    return trimmed;
}

export function parseMemoryExtractionText(text: string): {
    observations: string;
    signals: LearningSignal[];
} {
    const lines = text.trim().split(/\r?\n/u);
    const signalIndex = lines.findIndex((line) => line.trim().toUpperCase() === 'SIGNALS');
    if (signalIndex === -1) {
        return { observations: normalizeObservations(text), signals: [] };
    }

    const observationText = lines.slice(0, signalIndex).join('\n').trim();
    return {
        observations: normalizeObservations(observationText),
        signals: parseSignalLines(lines.slice(signalIndex + 1)),
    };
}

function parseSignalLines(lines: string[]): LearningSignal[] {
    const signals: LearningSignal[] = [];
    for (const line of lines) {
        const match = line.trim().match(/^-\s*([a-z_]+)(?:\[([^\]]+)\])?\s*:\s*(.+)$/iu);
        if (!match) {
            continue;
        }
        const kind = match[1]?.toLowerCase();
        const detail = match[3]?.trim();
        if (!detail) {
            continue;
        }
        if (kind === 'correction' || kind === 'frustration' || kind === 'technique') {
            signals.push({ detail, kind });
        }
        if (kind === 'skill_misfire') {
            const skillId = match[2]?.trim();
            signals.push(skillId ? { detail, kind, skillId } : { detail, kind });
        }
    }
    return signals;
}

async function listEnabledSkills(agentId: string) {
    const agent = getStoredAgent(agentId);
    if (!agent) {
        return [];
    }
    const skills = await listRuntimeSkills({ agent, includePluginSkills: false });
    const enabled = new Set(agent.enabledSkillIds);
    return skills
        .filter((skill) => enabled.has(skill.id))
        .map((skill) => ({ id: skill.id, name: skill.name }));
}
