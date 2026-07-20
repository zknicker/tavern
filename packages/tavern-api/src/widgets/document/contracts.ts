import * as z from 'zod';

const wikiDocumentPathSchema = z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => value.endsWith('.md'), 'Path must point at a .md Wiki page.')
    .refine(
        (value) =>
            !(value.startsWith('/') || value.includes('\\')) &&
            value.split('/').every((segment) => segment && segment !== '.' && segment !== '..'),
        'Path must stay inside the Wiki root.'
    );

/** Maintained shared Markdown page, carded in chat and opened in the artifact pane. */
export const widgetDocumentPropsSchema = z
    .object({
        path: wikiDocumentPathSchema,
        title: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

export type WidgetDocumentProps = z.output<typeof widgetDocumentPropsSchema>;
