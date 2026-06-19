import type { WidgetRenderInput } from '@tavern/api/widgets';
import {
    tavernRenderBarChartComponentId,
    tavernRenderBarChartPropsSchema,
    tavernRenderComposedChartComponentId,
    tavernRenderComposedChartPropsSchema,
    tavernRenderLineChartComponentId,
    tavernRenderLineChartPropsSchema,
} from '@tavern/api/widgets/charts';
import type { TavernResponseActivity } from '@tavern/sdk';
import type { ChatLogPage } from '../chat/contracts.ts';

type WidgetRow = Extract<ChatLogPage['rows'][number], { kind: 'widget' }>;

export function chartWidgetFromParsedPayload(
    block: WidgetRenderInput,
    activity: TavernResponseActivity
): WidgetRow['widget'] | null {
    if (
        block.component !== tavernRenderBarChartComponentId &&
        block.component !== tavernRenderLineChartComponentId &&
        block.component !== tavernRenderComposedChartComponentId
    ) {
        return null;
    }

    const propsSchema = chartPropsSchema(block.component);
    const parsedProps = propsSchema.safeParse(block.props);

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

function chartPropsSchema(component: string) {
    switch (component) {
        case tavernRenderBarChartComponentId:
            return tavernRenderBarChartPropsSchema;
        case tavernRenderLineChartComponentId:
            return tavernRenderLineChartPropsSchema;
        case tavernRenderComposedChartComponentId:
            return tavernRenderComposedChartPropsSchema;
        default:
            return tavernRenderBarChartPropsSchema;
    }
}
