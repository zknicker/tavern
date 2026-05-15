import { type ZodType, z } from 'zod';
import { checkDueClawHubSkillUpdates } from '../apps/server/src/skills/update-check.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;
const skillUpdateCheckIntervalMs = 24 * 60 * 60 * 1000;

export const checkSkillUpdatesJob = defineJob('check-skill-updates')
    .displayName('Check Skill Updates')
    .description('Checks installed ClawHub skills for newer published versions.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: skillUpdateCheckIntervalMs,
        runOnStart: true,
    })
    .work(async ({ fail, log }) => {
        try {
            const result = await checkDueClawHubSkillUpdates({ log });
            await log(`Checked ${result.checked} ClawHub skill(s).`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Skill update check failed: ${message}`);
            await fail('Skill update check failed.', error);
        }
    });
