import { updateTaskLabel } from '../../agent-runtime/labels.ts';
import { syncAgentRuntimeTasks } from '../../sync/agent-runtime-sync.ts';
import { emitLabelsUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';
import { labelSchema, updateLabelInputSchema } from './contracts.ts';

export const updateLabelRoute = publicProcedure
    .input(updateLabelInputSchema)
    .mutation(async ({ input }) => {
        const label = await updateTaskLabel(input.labelId, input.patch);
        if (!label) {
            return null;
        }
        refreshTasksInBackground('label update');
        emitLabelsUpdated();
        emitTasksUpdated();
        return labelSchema.parse(label);
    });

function refreshTasksInBackground(action: string) {
    void syncAgentRuntimeTasks().catch((error) => {
        console.warn(`[tavern] failed to refresh task records after ${action}`, error);
    });
}
