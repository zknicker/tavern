import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText } from 'ai';
import {
    modelCategoryModelRef,
    resolveModelCategorySelection,
} from '../models/category-settings.ts';
import {
    createLanguageModelForRuntime,
    supportsLanguageModelForRuntime,
} from '../models/language-model.ts';

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

export interface MemoryExtractionOutcome {
    model: AgentRuntimeModelName;
    /** Markdown observation bullets; empty when nothing durable was found. */
    observations: string;
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
        prompt: memoryExtractionPrompt(input),
        system: memoryExtractionInstructions,
    });
    return {
        model,
        observations: normalizeObservations(result.text),
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
].join('\n');

function memoryExtractionPrompt(input: MemoryExtractionInput) {
    return ['Transcript window:', '', renderExtractionTranscript(input.messages)].join('\n');
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
