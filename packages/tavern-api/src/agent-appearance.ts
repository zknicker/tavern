import * as z from 'zod';

// Characters are the agent's visible avatar. Every agent wears one; the eyes
// alone are never shown. Art for each kind lives in the app, but this list is
// the single source of truth both the app UI and Runtime validation share.
export const agentCharacters = [
    'knight',
    'penguin',
    'cat',
    'dog',
    'robot',
    'ghost',
    'cloud',
] as const;

export type AgentCharacter = (typeof agentCharacters)[number];

export const agentCharacterSchema = z.enum(agentCharacters);

export const agentCharacterLabels: Record<AgentCharacter, string> = {
    cat: 'Cat',
    cloud: 'Cloud',
    dog: 'Dog',
    ghost: 'Ghost',
    knight: 'Knight',
    penguin: 'Penguin',
    robot: 'Robot',
};

// Agents with no chosen character get a stable one derived from their id, so a
// fresh roster still reads as a varied crowd instead of all the same face.
export function resolveAgentDefaultCharacter(agentId: string): AgentCharacter {
    let hash = 0;

    for (let index = 0; index < agentId.length; index += 1) {
        hash = (hash * 31 + agentId.charCodeAt(index)) | 0;
    }

    return agentCharacters[Math.abs(hash) % agentCharacters.length];
}
