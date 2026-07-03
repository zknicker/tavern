import { prepareAgentEngineInstructions } from '../agent-engine/instructions.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import type { AgentExecutorInput } from './agent-executor.ts';

export interface BuildAgentInstructionOptions {
    db?: Database;
    seedSkills?: boolean;
    skillsDir?: string;
}

export async function buildAgentInstructions(
    input: AgentExecutorInput,
    options: BuildAgentInstructionOptions = {}
) {
    const prepared = await prepareAgentEngineInstructions(options.db ?? getDb(), input.agent, {
        seedSkills: options.seedSkills,
        skillsDir: options.skillsDir,
    });
    return prepared.content;
}
