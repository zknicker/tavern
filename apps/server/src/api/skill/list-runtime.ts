import { agentRuntimeSkillListSchema } from '@tavern/api';
import { z } from 'zod';
import { listAgentRuntimeSkills } from '../../agent-runtime/skills.ts';
import { publicProcedure } from '../trpc.ts';

const listRuntimeSkillsInputSchema = z
    .object({
        agentId: z.string().min(1).optional(),
    })
    .optional();

export const listRuntimeSkillsProcedure = publicProcedure
    .input(listRuntimeSkillsInputSchema)
    .output(agentRuntimeSkillListSchema)
    .query(async ({ input }) => ({
        skills:
            (await listAgentRuntimeSkills(undefined, undefined, {
                agentId: input?.agentId,
            })) ?? [],
    }));
