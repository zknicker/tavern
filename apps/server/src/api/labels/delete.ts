import { deleteTaskLabel } from '../../agent-runtime/labels.ts';
import { syncAgentRuntimeTasks } from '../../sync/agent-runtime-sync.ts';
import { emitLabelsUpdated, emitTasksUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';
import { deleteLabelInputSchema } from './contracts.ts';

export const deleteLabelRoute = publicProcedure
    .input(deleteLabelInputSchema)
    .mutation(async ({ input }) => {
        const result = await deleteTaskLabel(input.labelId);
        if (result.deleted) {
            refreshTasksInBackground('label delete');
            emitLabelsUpdated();
            emitTasksUpdated();
        }
        return result;
    });

function refreshTasksInBackground(action: string) {
    void syncAgentRuntimeTasks().catch((error) => {
        console.warn(`[tavern] failed to refresh task records after ${action}`, error);
    });
}
