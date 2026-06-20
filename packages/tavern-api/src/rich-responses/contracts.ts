import * as z from 'zod';
import {
    richResponseCalendarDayComponentType,
    richResponseCalendarEventComponentType,
} from './calendar/contracts.ts';
import {
    richResponseBarChartComponentType,
    richResponseComposedChartComponentType,
    richResponseLineChartComponentType,
} from './charts/contracts.ts';

export const richResponseComponentId = 'tavern.rich_response' as const;
export const richResponseTargetSchema = z.enum(['chat.inline']);

export const richResponseFallbackSchema = z
    .object({
        text: z.string().trim().min(1).max(500),
    })
    .strict();

export const richResponseComponentTypeSchema = z.enum([
    'Stack',
    'Heading',
    'Text',
    'Separator',
    'Table',
    richResponseBarChartComponentType,
    richResponseLineChartComponentType,
    richResponseComposedChartComponentType,
    richResponseCalendarEventComponentType,
    richResponseCalendarDayComponentType,
]);

export const richResponseStackPropsSchema = z
    .object({
        gap: z.enum(['sm', 'md', 'lg']).optional(),
    })
    .strict();

export const richResponseHeadingPropsSchema = z
    .object({
        text: z.string().trim().min(1).max(200),
    })
    .strict();

export const richResponseTextPropsSchema = z
    .object({
        muted: z.boolean().optional(),
        text: z.string().trim().min(1).max(1000),
    })
    .strict();

export const richResponseSeparatorPropsSchema = z.object({}).strict();

const tableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const richResponseTableColumnSchema = z
    .object({
        align: z.enum(['left', 'right']).optional(),
        key: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
    })
    .strict();

const richResponseTableCanonicalPropsSchema = z
    .object({
        columns: z.array(richResponseTableColumnSchema).min(1).max(8),
        rows: z.array(z.record(z.string(), tableValueSchema)).max(50),
    })
    .strict();

const richResponseTableMatrixPropsSchema = z
    .object({
        columns: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
        rows: z.array(z.array(tableValueSchema).max(8)).max(50),
    })
    .strict()
    .transform((props) => {
        const columns = props.columns.map((label, index) => ({
            key: `col_${index + 1}`,
            label,
        }));

        return {
            columns,
            rows: props.rows.map((row) =>
                Object.fromEntries(columns.map((column, index) => [column.key, row[index] ?? null]))
            ),
        };
    });

export const richResponseTablePropsSchema = z.union([
    richResponseTableCanonicalPropsSchema,
    richResponseTableMatrixPropsSchema,
]);

export const richResponseElementSchema = z
    .object({
        children: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
        props: z.record(z.string(), z.unknown()).default({}),
        type: richResponseComponentTypeSchema,
    })
    .strict()
    .superRefine((element, context) => {
        if (element.type === 'Stack') {
            return;
        }

        if (element.children && element.children.length > 0) {
            context.addIssue({
                code: 'custom',
                message: `${element.type} does not accept children.`,
                path: ['children'],
            });
        }
    });

export const richResponseSpecSchema = z
    .object({
        elements: z.record(z.string().trim().min(1).max(120), richResponseElementSchema),
        root: z.string().trim().min(1).max(120),
        state: z.record(z.string(), z.unknown()).default({}),
    })
    .strict()
    .superRefine((spec, context) => {
        const elementIds = Object.keys(spec.elements);

        if (elementIds.length > 80) {
            context.addIssue({
                code: 'custom',
                message: 'Rich Response specs support at most 80 elements.',
                path: ['elements'],
            });
        }

        if (!spec.elements[spec.root]) {
            context.addIssue({
                code: 'custom',
                message: 'Rich Response root must reference an existing element.',
                path: ['root'],
            });
        }

        for (const [id, element] of Object.entries(spec.elements)) {
            for (const childId of element.children ?? []) {
                if (!spec.elements[childId]) {
                    context.addIssue({
                        code: 'custom',
                        message: `Child element "${childId}" does not exist.`,
                        path: ['elements', id, 'children'],
                    });
                }
            }
        }
    });

export const richResponseRenderInputSchema = z
    .object({
        component: z.literal(richResponseComponentId),
        fallback: richResponseFallbackSchema,
        props: z
            .object({
                spec: richResponseSpecSchema,
            })
            .strict(),
        target: richResponseTargetSchema,
    })
    .strict();

export const richResponsePatchSchema = z
    .object({
        op: z.enum(['add', 'replace']),
        path: z.string().trim().min(1).max(500),
        value: z.unknown(),
    })
    .strict();

export type RichResponseComponentType = z.infer<typeof richResponseComponentTypeSchema>;
export type RichResponseElement = z.infer<typeof richResponseElementSchema>;
export type RichResponseFallback = z.infer<typeof richResponseFallbackSchema>;
export type RichResponsePatch = z.infer<typeof richResponsePatchSchema>;
export type RichResponseRenderInput = z.infer<typeof richResponseRenderInputSchema>;
export type RichResponseSpec = z.infer<typeof richResponseSpecSchema>;
export type RichResponseTarget = z.infer<typeof richResponseTargetSchema>;
