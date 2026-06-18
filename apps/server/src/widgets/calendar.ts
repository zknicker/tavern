import type { WidgetRenderInput } from '@tavern/api/widgets';
import {
    tavernRenderCalendarEventComponentId,
    tavernRenderCalendarEventPropsSchema,
} from '@tavern/api/widgets/calendar';
import type { TavernResponseActivity } from '@tavern/sdk';
import type { ChatLogPage } from '../chat/contracts.ts';

type WidgetRow = Extract<ChatLogPage['rows'][number], { kind: 'widget' }>;

export function calendarWidgetFromParsedPayload(
    block: WidgetRenderInput,
    activity: TavernResponseActivity
): WidgetRow['widget'] | null {
    if (block.component !== tavernRenderCalendarEventComponentId) {
        return null;
    }

    const parsedProps = tavernRenderCalendarEventPropsSchema.safeParse(block.props);

    return {
        component: block.component,
        fallbackText: block.fallback.text,
        id: activity.id,
        props: parsedProps.success ? parsedProps.data : null,
        target: block.target,
        validationError: parsedProps.success
            ? null
            : parsedProps.error.issues[0]?.message || 'Invalid widget props.',
    };
}
