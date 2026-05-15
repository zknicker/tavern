import { listSkills } from '../../skills/service.ts';
import { publicProcedure } from '../trpc.ts';

export const listSkillsProcedure = publicProcedure.query(() => listSkills());
