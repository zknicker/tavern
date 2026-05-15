import { createRouter } from '../trpc.ts';
import { deleteMessagingBindingProcedure } from './delete-binding.ts';
import { listMessagingPlatformsProcedure } from './list.ts';
import { saveMessagingBindingProcedure } from './save-binding.ts';

export const messagingPlatformRouter = createRouter({
    deleteBinding: deleteMessagingBindingProcedure,
    list: listMessagingPlatformsProcedure,
    saveBinding: saveMessagingBindingProcedure,
});
