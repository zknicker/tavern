import { createRouter } from '../trpc.ts';
import { linkParticipantRoute } from './link.ts';
import { listParticipantsRoute } from './list.ts';
import { saveParticipantSettings } from './save-settings.ts';

export const participantRouter = createRouter({
    link: linkParticipantRoute,
    list: listParticipantsRoute,
    saveSettings: saveParticipantSettings,
});
