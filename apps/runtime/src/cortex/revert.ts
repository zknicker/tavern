import type { CortexEditPageResult, CortexRevertPageInput } from '@tavern/api';
import type { CortexDatabase } from './db';
import { editCortexPage } from './edit';
import { getCortexPageVersion } from './page-versions';

export async function revertCortexPage(
    db: CortexDatabase,
    slugOrId: string,
    input: CortexRevertPageInput
): Promise<CortexEditPageResult> {
    const version = await getCortexPageVersion(db, slugOrId, input.versionId);
    return await editCortexPage(db, {
        action: 'upsert',
        body: version.body,
        compiledTruth: version.compiledTruth,
        frontmatter: version.frontmatter,
        slug: version.slug,
        source: input.source,
        status: version.status,
        summary: `Reverted ${version.slug} to version ${version.versionNumber}.`,
        tags: readStringArray(version.frontmatter.tags),
        title: version.title,
        type: version.type,
    });
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}
