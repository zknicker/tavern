import { readFile } from 'node:fs/promises';
import {
    agentRuntimeJobDetailSchema,
    agentRuntimeRoutes,
    agentRuntimeRunJobSchema,
    cortexBacklinkListSchema,
    cortexCaptureResultSchema,
    cortexEditPageResultSchema,
    cortexGraphTraversalSchema,
    cortexIngestResultSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexPageVersionListSchema,
    cortexRecallResultSchema,
    cortexSearchResultSchema,
    cortexSettingsSchema,
    cortexStatusSchema,
} from '@tavern/api';
import runtimePackage from '../package.json';
import { getRuntimePort } from './config';

type RuntimeCommand = 'help' | 'restart' | 'serve' | 'update' | 'version';
type RuntimeJobRun = ReturnType<typeof agentRuntimeJobDetailSchema.parse>['recentRuns'][number];

const cortexEmbedPollIntervalMs = 1000;
const cortexEmbedPollTimeoutMs = 30 * 60 * 1000;

interface ParsedCli {
    command: RuntimeCommand;
    rest: string[];
}

interface CortexCliOptions {
    json: boolean;
    runtimeUrl: string;
}

export function parseCli(args: string[]): ParsedCli {
    const [command, ...rest] = args;

    if (!command || command === 'serve') {
        return { command: 'serve', rest };
    }

    if (command === '--help' || command === '-h' || command === 'help') {
        return { command: 'help', rest };
    }

    if (command === '--version' || command === '-v' || command === 'version') {
        return { command: 'version', rest };
    }

    if (command === 'update' || command === 'restart') {
        return { command, rest };
    }

    if (command === 'cortex') {
        return { command: 'serve', rest: [command, ...rest] };
    }

    throw new Error(`Unknown command: ${command}`);
}

export function printHelp(): void {
    console.log(`Tavern Runtime ${runtimePackage.version}

Usage:
  tavern serve
  tavern cortex capture <text|--stdin|--file <path>> [--title <title>] [--type <type>] [--tag <tag>...] [--quiet]
  tavern cortex ingest <kind> <text|--stdin|--file <path>> [--locator <locator>] [--title <title>] [--type <type>] [--tag <tag>...] [--json]
  tavern cortex get <slug> [--json]
  tavern cortex list [--limit <n>] [--json]
  tavern cortex put <slug> <text|--stdin|--file <path>> [--title <title>] [--type <type>] [--tag <tag>...] [--json]
  tavern cortex delete <slug> [--json]
  tavern cortex restore <slug> [--json]
  tavern cortex history <slug> [--json]
  tavern cortex revert <slug> <version> [--json]
  tavern cortex tag <slug> <tag> [--json]
  tavern cortex untag <slug> <tag> [--json]
  tavern cortex tags <slug> [--json]
  tavern cortex link <from> <to> [--type <type>] [--json]
  tavern cortex unlink <from> <to> [--type <type>] [--json]
  tavern cortex backlinks <slug> [--json]
  tavern cortex graph-query <slug> [--depth <n>] [--direction <out|in|both>] [--type <type>] [--json]
  tavern cortex timeline <slug> [--json]
  tavern cortex timeline-add <slug> <date> <text> [--json]
  tavern cortex search <query> [--limit <n>] [--offset <n>] [--explain] [--json]
  tavern cortex search diagnose <query> --target <slug> [--json]
  tavern cortex search modes [--json]
  tavern cortex search stats [--json]
  tavern cortex recall <query> [--mode <mode>] [--limit <n>] [--json]
  tavern cortex embed --stale [--json]
  tavern cortex status [--json]
  tavern cortex stats [--json]
  tavern cortex health [--json]
  tavern update
  tavern restart
  tavern --version
  tavern --help

Commands:
  serve        Run the foreground Tavern Runtime server.
  cortex       Use the managed Cortex through a running Tavern Runtime.
  update       Stage a Runtime upgrade through Homebrew without restarting the service.
  restart      Restart the Homebrew tavern-runtime service.

Cortex commands:
  capture      Save explicit durable knowledge to Cortex.
  ingest       Ingest source-backed text into Cortex.
  get          Print one Cortex page.
  list         List Cortex pages.
  put          Rewrite or create a Cortex page.
  delete       Delete a Cortex page.
  restore      Restore an archived Cortex page.
  history      Show page version history.
  revert       Revert a page to a prior version.
  tag          Add a page tag.
  untag        Remove a page tag.
  tags         List page tags.
  link         Add a typed page link.
  unlink       Remove a typed frontmatter link.
  backlinks    List inbound links to a page.
  graph-query  Traverse Cortex page links.
  timeline     List page timeline entries.
  timeline-add Add a dated timeline entry.
  search       Search Cortex pages and chunks.
  recall       Build recall context for agent or synthesis work.
  embed        Generate embeddings for stale Cortex chunks.
  status       Show Cortex page, chunk, embedding, and index counts.
  stats        Show GBrain-style Cortex statistics.
  health       Show Cortex health recommendations.

Options:
  --runtime-url <url>    Runtime API URL for this command.
  --json                 Print machine-readable JSON when supported.
  --limit <n>            Limit search or recall hits.
  --offset <n>           Skip search results for pagination.
  --explain              Include per-result search diagnostics.
  --mode <mode>          Recall mode: conservative, balanced, or tokenmax.
  --stale                Embed only stale or missing Cortex chunks.
  --file <path>          Read command content from a file.
  --stdin                Read command content from stdin.
  --locator <locator>    Source locator for ingest.
  --quiet                Print only the captured page slug.
  --direction <dir>      Graph direction: out, in, or both.

Examples:
  tavern cortex capture "Blippy prefers short replies" --type preference --tag agent
  tavern cortex ingest article --file ./note.txt --locator https://example.com/note
  echo "full page body" | tavern cortex put blippy-profile --stdin --title "Blippy Profile"
  tavern cortex graph-query blippy-profile --depth 2 --direction both
  tavern cortex embed --stale
  tavern cortex recall "what should I know before replying?" --mode balanced

Environment:
  TAVERN_RUNTIME_URL    Runtime API URL for CLI client commands.
  TAVERN_RUNTIME_HOST   Bind host. Defaults to 127.0.0.1.
  TAVERN_RUNTIME_PORT   Bind port. Defaults to 18790.
  TAVERN_RUNTIME_ROOT   Runtime data root. Defaults to ~/.tavern/runtime.`);
}

export async function runCortexCli(args: string[]): Promise<void> {
    const options = readCortexCliOptions(args);
    const commandIndex = findCommandIndex(args);
    const command = commandIndex === -1 ? null : args[commandIndex];
    const rest = commandIndex === -1 ? [] : args.slice(commandIndex + 1);

    switch (command) {
        case 'capture':
            await captureCortex(rest, options);
            return;
        case 'backlinks':
            await showCortexBacklinks(rest, options);
            return;
        case 'delete':
            await deleteCortexPage(rest, options);
            return;
        case 'embed':
            await embedCortex(rest, options);
            return;
        case 'get':
            await getCortexPageCli(rest, options);
            return;
        case 'graph-query':
        case 'graph':
            await graphQueryCortex(rest, options);
            return;
        case 'health':
            await showCortexHealth(options);
            return;
        case 'history':
            await showCortexHistory(rest, options);
            return;
        case 'ingest':
            await ingestCortex(rest, options);
            return;
        case 'link':
            await linkCortexPages(rest, options);
            return;
        case 'list':
            await listCortexPagesCli(rest, options);
            return;
        case 'put':
            await putCortexPage(rest, options);
            return;
        case 'recall':
            await recallCortex(rest, options);
            return;
        case 'restore':
            await restoreCortexPage(rest, options);
            return;
        case 'revert':
            await revertCortexPage(rest, options);
            return;
        case 'search':
            await searchCortex(rest, options);
            return;
        case 'status':
            await showCortexStatus(options);
            return;
        case 'stats':
            await showCortexStats(options);
            return;
        case 'tag':
            await tagCortexPage(rest, options);
            return;
        case 'tags':
            await showCortexTags(rest, options);
            return;
        case 'timeline':
            await showCortexTimeline(rest, options);
            return;
        case 'timeline-add':
            await addCortexTimeline(rest, options);
            return;
        case 'untag':
            await untagCortexPage(rest, options);
            return;
        case 'unlink':
            await unlinkCortexPages(rest, options);
            return;
        default:
            printHelp();
            throw new Error(
                command ? `Unknown cortex command: ${command}` : 'Missing cortex command.'
            );
    }
}

function findCommandIndex(args: string[]): number {
    const flagsWithValues = new Set([
        '--limit',
        '--locator',
        '--metadata-json',
        '--mode',
        '--offset',
        '--target',
        '--direction',
        '--depth',
        '--file',
        '--runtime-url',
        '--source',
        '--tag',
        '--title',
        '--type',
    ]);
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg.startsWith('--')) {
            if (flagsWithValues.has(arg)) {
                index += 1;
            }
            continue;
        }
        return index;
    }
    return -1;
}

function readCortexCliOptions(args: string[]): CortexCliOptions {
    const runtimeUrl = readOption(args, '--runtime-url') ?? process.env.TAVERN_RUNTIME_URL;
    return {
        json: args.includes('--json'),
        runtimeUrl: runtimeUrl ?? `http://127.0.0.1:${getRuntimePort()}`,
    };
}

async function captureCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const content = await readContentArgument(args, { fallback: 'Missing capture content.' });
    const title = readOption(args, '--title') ?? deriveTitle(content);
    const type = readOption(args, '--type') ?? 'note';
    const tags = readRepeatedOption(args, '--tag');
    const result = cortexCaptureResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexCapture, {
            body: {
                content,
                source: {
                    actorId: 'tavern-cli',
                    actorKind: 'user',
                },
                tags,
                title,
                type,
            },
            method: 'POST',
        })
    );

    if (!options.json && args.includes('--quiet')) {
        console.log(result.page.slug);
        return;
    }
    writeOutput(options, result, `Captured ${result.page.slug}`);
}

async function ingestCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const kind = readPositional(args);
    const content = await readContentArgument(args.slice(1), {
        fallback: 'Missing ingest content.',
    });
    const result = cortexIngestResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexIngest, {
            body: {
                actor: cliSource('ingest'),
                content,
                kind,
                locator: readOption(args, '--locator') ?? undefined,
                metadata: readJsonOption(args, '--metadata-json') ?? {},
                tags: readRepeatedOption(args, '--tag'),
                title: readOption(args, '--title') ?? undefined,
                type: readOption(args, '--type') ?? undefined,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Ingested ${result.sourceRef.kind}: ${result.page.slug}`);
}

async function getCortexPageCli(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    writeOutput(options, page, formatPage(page));
}

async function listCortexPagesCli(args: string[], options: CortexCliOptions): Promise<void> {
    const limit = readNumberOption(args, '--limit') ?? 100;
    const pages = cortexPageListSchema.parse(
        await runtimeJson(options, `${agentRuntimeRoutes.cortexPages}?limit=${limit}`, {
            method: 'GET',
        })
    );
    writeOutput(
        options,
        pages,
        pages.pages.map((page) => `${page.slug}\t${page.type}\t${page.title}`).join('\n')
    );
}

async function putCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const content = await readContentArgument(args.slice(1), { fallback: 'Missing page content.' });
    const existing = await getOptionalCortexPage(options, slug);
    const title = readOption(args, '--title') ?? existing?.title ?? slug;
    const tags = readRepeatedOption(args, '--tag');
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'upsert',
                body: content,
                compiledTruth: content,
                slug,
                source: cliSource('put'),
                status: 'active',
                tags: tags.length > 0 ? tags : (existing?.tags ?? []),
                title,
                type: readOption(args, '--type') ?? existing?.type ?? 'note',
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Put ${result.pages[0]?.slug ?? slug}`);
}

async function deleteCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'delete',
                slugOrId: slug,
                source: cliSource('delete'),
                summary: `Deleted ${slug}.`,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Deleted ${result.pages[0]?.slug ?? slug}`);
}

async function restoreCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'upsert',
                body: page.body,
                compiledTruth: page.compiledTruth,
                frontmatter: page.frontmatter,
                slug: page.slug,
                source: cliSource('restore'),
                status: 'active',
                tags: page.tags,
                title: page.title,
                type: page.type,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Restored ${result.pages[0]?.slug ?? slug}`);
}

async function showCortexHistory(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const history = cortexPageVersionListSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexHistory(slug), { method: 'GET' })
    );
    writeOutput(
        options,
        history,
        history.versions
            .map(
                (version) =>
                    `${version.versionNumber}\t${version.createdAt}\t${version.status}\t${version.title}`
            )
            .join('\n') || `No versions found for ${history.slug}.`
    );
}

async function revertCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const [slug, versionId] = readPositionals(args, 2);
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexRevert(slug), {
            body: {
                source: cliSource('revert'),
                versionId,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Reverted ${result.pages[0]?.slug ?? slug} to ${versionId}`);
}

async function tagCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const [slug, tag] = readPositionals(args, 2);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    await updateCortexPageFrontmatter(options, page.slug, {
        frontmatter: page.frontmatter,
        tags: uniqueStrings([...page.tags, tag]),
    });
    writeOutput(
        options,
        { slug: page.slug, tags: uniqueStrings([...page.tags, tag]) },
        `Tagged ${page.slug}`
    );
}

async function showCortexTags(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    writeOutput(options, { slug: page.slug, tags: page.tags }, page.tags.join('\n'));
}

async function untagCortexPage(args: string[], options: CortexCliOptions): Promise<void> {
    const [slug, tag] = readPositionals(args, 2);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    const tags = page.tags.filter((value) => value !== tag);
    await updateCortexPageFrontmatter(options, page.slug, { frontmatter: page.frontmatter, tags });
    writeOutput(options, { slug: page.slug, tags }, `Untagged ${page.slug}`);
}

async function linkCortexPages(args: string[], options: CortexCliOptions): Promise<void> {
    const [from, to] = readPositionals(args, 2);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(from), { method: 'GET' })
    );
    const linkKind = readOption(args, '--type') ?? 'mentions';
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'upsert',
                body: page.body,
                compiledTruth: page.compiledTruth,
                frontmatter: page.frontmatter,
                links: [{ linkKind, targetSlug: to }],
                slug: page.slug,
                source: cliSource('link'),
                tags: page.tags,
                title: page.title,
                type: page.type,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Linked ${from} -> ${to}`);
}

async function unlinkCortexPages(args: string[], options: CortexCliOptions): Promise<void> {
    const [from, to] = readPositionals(args, 2);
    const linkKind = readOption(args, '--type') ?? 'mentions';
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(from), { method: 'GET' })
    );
    const frontmatter = { ...page.frontmatter };
    frontmatter[linkKind] = readStringArray(frontmatter[linkKind]).filter((value) => value !== to);
    await updateCortexPageFrontmatter(options, page.slug, { frontmatter, tags: page.tags });
    writeOutput(options, { from, linkKind, to }, `Unlinked ${from} -> ${to}`);
}

async function showCortexBacklinks(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const backlinks = cortexBacklinkListSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexBacklinks(slug), { method: 'GET' })
    );
    writeOutput(
        options,
        backlinks,
        backlinks.links
            .map((link) => `${link.fromPageId}\t${link.linkKind}\t${link.targetSlug}`)
            .join('\n')
    );
}

async function embedCortex(args: string[], options: CortexCliOptions): Promise<void> {
    if (!args.includes('--stale')) {
        throw new Error('Use `tavern cortex embed --stale` for incremental Cortex embeddings.');
    }
    const queued = agentRuntimeRunJobSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.jobRun('cortex-generate-embeddings'), {
            body: { payload: { stale: true } },
            method: 'POST',
        })
    );
    const run = await pollRuntimeJobRun(options, 'cortex-generate-embeddings', queued.jobId);
    if (run.state === 'failed') {
        writeCompletedRun(options, run);
        throw new Error(run.error ?? 'Cortex embedding job failed.');
    }
    writeCompletedRun(options, run);
}

async function graphQueryCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const root = readPositional(args);
    const depth = readNumberOption(args, '--depth') ?? 5;
    const direction = readGraphDirection(readOption(args, '--direction') ?? 'out');
    const linkKind = readOption(args, '--type');
    const graph = await traverseCortexGraph(options, root, { depth, direction, linkKind });
    writeOutput(
        options,
        graph,
        graph.paths
            .map(
                (path) =>
                    `${'  '.repeat(path.depth - 1)}${path.fromSlug} --${path.linkKind}-> ${path.toSlug}`
            )
            .join('\n') || `No edges found from ${root}.`
    );
}

async function showCortexTimeline(args: string[], options: CortexCliOptions): Promise<void> {
    const slug = readPositional(args);
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    writeOutput(
        options,
        { slug: page.slug, timeline: page.timeline },
        page.timeline.map((entry) => `${entry.createdAt}\t${entry.body}`).join('\n')
    );
}

async function addCortexTimeline(args: string[], options: CortexCliOptions): Promise<void> {
    const positionals = readPositionals(args);
    const [slug, date] = positionals;
    const body = positionals.slice(2).join(' ').trim();
    if (!body) {
        throw new Error('Missing timeline entry text.');
    }
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    const result = cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'upsert',
                body: page.body,
                compiledTruth: page.compiledTruth,
                frontmatter: page.frontmatter,
                slug: page.slug,
                source: cliSource('timeline-add'),
                tags: page.tags,
                timelineEntries: [{ body, createdAt: dateToIso(date) }],
                title: page.title,
                type: page.type,
            },
            method: 'POST',
        })
    );
    writeOutput(options, result, `Added timeline entry to ${page.slug}`);
}

async function recallCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const query = readPositional(args);
    const limit = readNumberOption(args, '--limit');
    const mode = readOption(args, '--mode');
    const result = cortexRecallResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexRecall, {
            body: {
                limit,
                ...(mode ? { mode } : {}),
                query,
            },
            method: 'POST',
        })
    );
    writeSearchOutput(options, result);
}

async function searchCortex(args: string[], options: CortexCliOptions): Promise<void> {
    const subcommand = args.find((arg) => !arg.startsWith('--'));
    if (subcommand === 'diagnose') {
        await diagnoseCortexSearch(args.slice(args.indexOf('diagnose') + 1), options);
        return;
    }
    if (subcommand === 'modes') {
        await showCortexSearchModes(options);
        return;
    }
    if (subcommand === 'stats') {
        await showCortexSearchStats(options);
        return;
    }
    const query = readPositional(args);
    const limit = readNumberOption(args, '--limit');
    const offset = readNonnegativeNumberOption(args, '--offset') ?? 0;
    const result = cortexSearchResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexSearch, {
            body: {
                explain: args.includes('--explain'),
                limit,
                offset,
                query,
            },
            method: 'POST',
        })
    );
    writeSearchOutput(options, result);
}

async function diagnoseCortexSearch(args: string[], options: CortexCliOptions): Promise<void> {
    const query = readPositional(args);
    const target = readOption(args, '--target');
    if (!target) {
        throw new Error('Usage: tavern cortex search diagnose <query> --target <slug>');
    }
    const normalizedTarget = normalizeCliSlug(target);
    const result = cortexSearchResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexSearch, {
            body: {
                explain: true,
                limit: 50,
                offset: 0,
                query,
            },
            method: 'POST',
        })
    );
    const targetHit = result.hits.find((hit) => hit.page.slug === normalizedTarget);
    const report = {
        query,
        target: normalizedTarget,
        topSlug: result.hits[0]?.page.slug ?? null,
        vectorDegradedReason: result.vectorDegradedReason,
        verdict: targetHit
            ? `target is rank ${targetHit.diagnostics?.rank ?? result.hits.indexOf(targetHit) + 1}`
            : `target absent from top ${result.limit}`,
        diagnostics: targetHit?.diagnostics ?? null,
    };
    writeOutput(
        options,
        report,
        [
            `Diagnose: "${query}" -> ${normalizedTarget}`,
            `  top: ${report.topSlug ?? '-'}`,
            `  target: ${report.verdict}`,
            report.diagnostics
                ? `  evidence: ${report.diagnostics.evidence.join(', ') || '-'}  score=${report.diagnostics.finalScore.toFixed(3)}`
                : '  evidence: -',
            report.vectorDegradedReason
                ? `  vector: degraded (${report.vectorDegradedReason})`
                : '',
        ]
            .filter(Boolean)
            .join('\n')
    );
}

async function showCortexSearchModes(options: CortexCliOptions): Promise<void> {
    const settings = cortexSettingsSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexSettings, { method: 'GET' })
    );
    const modes = {
        active: settings.recall.mode,
        modes: [
            { expansion: false, limit: 10, mode: 'conservative' },
            { expansion: false, limit: 25, mode: 'balanced' },
            { expansion: true, limit: 50, mode: 'tokenmax' },
        ],
    };
    writeOutput(
        options,
        modes,
        [
            `Active search mode: ${modes.active}`,
            'conservative  limit=10  expansion=false',
            'balanced      limit=25  expansion=false',
            'tokenmax      limit=50  expansion=true',
        ].join('\n')
    );
}

async function showCortexSearchStats(options: CortexCliOptions): Promise<void> {
    const status = cortexStatusSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexStatus, { method: 'GET' })
    );
    const stats = {
        currentEmbeddings: status.encoding.currentCount,
        linkCount: status.linkCount,
        pageCount: status.pageCount,
        staleEmbeddings: status.encoding.staleCount,
        timelineEntryCount: status.timelineEntryCount,
        vectorIndexedCount: status.vectorIndex.indexedCount,
    };
    writeOutput(
        options,
        stats,
        [
            `Pages: ${stats.pageCount}`,
            `Links: ${stats.linkCount}`,
            `Timeline: ${stats.timelineEntryCount}`,
            `Current embeddings: ${stats.currentEmbeddings}`,
            `Stale embeddings: ${stats.staleEmbeddings}`,
            `Vector indexed: ${stats.vectorIndexedCount}`,
        ].join('\n')
    );
}

async function showCortexStatus(options: CortexCliOptions): Promise<void> {
    const status = cortexStatusSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexStatus, { method: 'GET' })
    );
    writeOutput(
        options,
        status,
        [
            `Pages: ${status.pageCount}`,
            `Chunks: ${status.chunkCount}`,
            `Current embeddings: ${status.encoding.currentCount}`,
            `Stale embeddings: ${status.encoding.staleCount}`,
        ].join('\n')
    );
}

async function showCortexStats(options: CortexCliOptions): Promise<void> {
    const status = cortexStatusSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexStatus, { method: 'GET' })
    );
    writeOutput(
        options,
        status,
        [
            'Cortex statistics',
            `pages: ${status.pageCount}`,
            `sources: ${status.sourceCount}`,
            `links: ${status.linkCount}`,
            `timeline entries: ${status.timelineEntryCount}`,
            `claims: ${status.claimCount}`,
            `chunks: ${status.chunkCount}`,
            `embeddings: ${status.encoding.currentCount}/${status.encoding.totalCount} current`,
            `stale embeddings: ${status.encoding.staleCount}`,
            `vector index: ${status.vectorIndex.indexedCount} indexed`,
        ].join('\n')
    );
}

async function showCortexHealth(options: CortexCliOptions): Promise<void> {
    const status = cortexStatusSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexStatus, { method: 'GET' })
    );
    writeOutput(
        options,
        {
            recommendations: status.recommendations,
            score: Math.max(0, 10 - status.recommendations.length),
        },
        status.recommendations.length === 0
            ? 'Cortex health: ok'
            : status.recommendations
                  .map((item) => `${item.severity}\t${item.kind}\t${item.count}\t${item.summary}`)
                  .join('\n')
    );
}

async function runtimeJson(
    options: CortexCliOptions,
    path: string,
    init: { body?: unknown; method: 'GET' | 'POST' }
): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(new URL(path, options.runtimeUrl), {
            body: init.body ? JSON.stringify(init.body) : undefined,
            headers: init.body ? { 'content-type': 'application/json' } : undefined,
            method: init.method,
        });
    } catch (error) {
        throw new Error(
            `Could not reach Tavern Runtime at ${options.runtimeUrl}: ${readErrorMessage(error)}`
        );
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(readRuntimeError(data, response.status));
    }
    return data;
}

async function pollRuntimeJobRun(
    options: CortexCliOptions,
    slug: string,
    jobId: string
): Promise<RuntimeJobRun> {
    const startedAt = Date.now();
    let lastStatus = '';
    while (Date.now() - startedAt < cortexEmbedPollTimeoutMs) {
        const detail = agentRuntimeJobDetailSchema.parse(
            await runtimeJson(options, agentRuntimeRoutes.job(slug), { method: 'GET' })
        );
        const run = detail.recentRuns.find((candidate) => candidate.id === jobId);
        if (run) {
            if (!options.json) {
                const status = `${run.state}:${run.progress}`;
                if (status !== lastStatus) {
                    console.error(`${slug} ${run.state} ${run.progress}%`);
                    lastStatus = status;
                }
            }
            if (run.state === 'completed' || run.state === 'failed') {
                return run;
            }
        }
        await sleep(cortexEmbedPollIntervalMs);
    }
    throw new Error(`Timed out waiting for ${slug} job ${jobId}.`);
}

function writeCompletedRun(options: CortexCliOptions, run: RuntimeJobRun): void {
    if (options.json) {
        console.log(JSON.stringify(run, null, 2));
        return;
    }
    for (const log of run.logs) {
        console.log(log);
    }
    if (run.logs.length === 0) {
        console.log(`${run.state}: ${run.id}`);
    }
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

function writeOutput(options: CortexCliOptions, data: unknown, text: string): void {
    console.log(options.json ? JSON.stringify(data, null, 2) : text);
}

function writeSearchOutput(
    options: CortexCliOptions,
    result: {
        hits: Array<{
            diagnostics?: {
                evidence: string[];
                finalScore: number;
                lexicalScore: number;
                rank: number;
                vectorScore: null | number;
            };
            page: { slug: string; title: string };
            score: number;
            snippet: string;
        }>;
        vectorDegradedReason: null | string;
    }
): void {
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    if (result.vectorDegradedReason) {
        console.warn(`Vector recall degraded: ${result.vectorDegradedReason}`);
    }
    for (const hit of result.hits) {
        console.log(`${hit.page.slug}\t${hit.score.toFixed(3)}\t${hit.page.title}`);
        if (hit.diagnostics) {
            console.log(
                `  rank=${hit.diagnostics.rank} lexical=${hit.diagnostics.lexicalScore.toFixed(3)} vector=${hit.diagnostics.vectorScore?.toFixed(3) ?? '-'} evidence=${hit.diagnostics.evidence.join(',') || '-'}`
            );
        }
        if (hit.snippet) {
            console.log(`  ${hit.snippet}`);
        }
    }
}

async function updateCortexPageFrontmatter(
    options: CortexCliOptions,
    slug: string,
    input: {
        frontmatter: Record<string, unknown>;
        tags: string[];
    }
) {
    const page = cortexPageSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
    );
    return cortexEditPageResultSchema.parse(
        await runtimeJson(options, agentRuntimeRoutes.cortexEdit, {
            body: {
                action: 'upsert',
                body: page.body,
                compiledTruth: page.compiledTruth,
                frontmatter: input.frontmatter,
                slug: page.slug,
                source: cliSource('update'),
                tags: input.tags,
                title: page.title,
                type: page.type,
            },
            method: 'POST',
        })
    );
}

async function getOptionalCortexPage(options: CortexCliOptions, slug: string) {
    try {
        return cortexPageSchema.parse(
            await runtimeJson(options, agentRuntimeRoutes.cortexPage(slug), { method: 'GET' })
        );
    } catch {
        return null;
    }
}

async function traverseCortexGraph(
    options: CortexCliOptions,
    root: string,
    input: {
        depth: number;
        direction: 'both' | 'in' | 'out';
        linkKind: null | string;
    }
): Promise<ReturnType<typeof cortexGraphTraversalSchema.parse>> {
    const path = new URL(agentRuntimeRoutes.cortexGraph(root), options.runtimeUrl);
    path.searchParams.set('depth', String(input.depth));
    path.searchParams.set('direction', input.direction);
    if (input.linkKind) {
        path.searchParams.set('type', input.linkKind);
    }
    return cortexGraphTraversalSchema.parse(
        await runtimeJson(options, path.pathname + path.search, { method: 'GET' })
    );
}

function readOption(args: string[], flag: string): string | null {
    const index = args.indexOf(flag);
    if (index === -1) {
        return null;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${flag}.`);
    }
    return value;
}

function readRepeatedOption(args: string[], flag: string): string[] {
    const values: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === flag) {
            const value = args[index + 1];
            if (!value || value.startsWith('--')) {
                throw new Error(`Missing value for ${flag}.`);
            }
            values.push(value);
        }
    }
    return values;
}

function readJsonOption(args: string[], flag: string): Record<string, unknown> | null {
    const value = readOption(args, flag);
    if (value === null) {
        return null;
    }
    const parsed = JSON.parse(value) as unknown;
    if (!(parsed && typeof parsed === 'object' && !Array.isArray(parsed))) {
        throw new Error(`${flag} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
}

function readNumberOption(args: string[], flag: string): number | undefined {
    const value = readOption(args, flag);
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${flag} must be a positive integer.`);
    }
    return parsed;
}

function readNonnegativeNumberOption(args: string[], flag: string): number | undefined {
    const value = readOption(args, flag);
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${flag} must be a nonnegative integer.`);
    }
    return parsed;
}

async function readContentArgument(
    args: string[],
    input: {
        fallback: string;
    }
): Promise<string> {
    const filePath = readOption(args, '--file');
    if (filePath) {
        return (await readFile(filePath, 'utf8')).trim();
    }
    if (args.includes('--stdin')) {
        return (await readStdin()).trim();
    }
    const content = readOptionalPositional(args);
    if (!content) {
        throw new Error(input.fallback);
    }
    return content;
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

function readPositional(args: string[]): string {
    const value = readOptionalPositional(args);
    if (!value) {
        throw new Error('Missing required text argument.');
    }
    return value;
}

function readOptionalPositional(args: string[]): string | null {
    const value = args.find((arg, index) => {
        if (arg.startsWith('--')) {
            return false;
        }
        return index === 0 || !args[index - 1]?.startsWith('--');
    });
    return value ?? null;
}

function readPositionals(args: string[], count?: number): string[] {
    const values = args.filter((arg, index) => {
        if (arg.startsWith('--')) {
            return false;
        }
        return index === 0 || !args[index - 1]?.startsWith('--');
    });
    if (count !== undefined && values.length < count) {
        throw new Error(`Expected ${count} positional argument(s).`);
    }
    return count === undefined ? values : values.slice(0, count);
}

function deriveTitle(content: string): string {
    const trimmed = content.trim().replace(/\s+/g, ' ');
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

function readRuntimeError(data: unknown, status: number): string {
    if (data && typeof data === 'object' && 'message' in data) {
        return String(data.message);
    }
    return `Tavern Runtime request failed with HTTP ${status}.`;
}

function readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function cliSource(action: string) {
    return {
        actorId: 'tavern-cli',
        actorKind: 'user' as const,
        messageId: `cli:${action}`,
    };
}

function dateToIso(date: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
        return `${date}T00:00:00.000Z`;
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date: ${date}.`);
    }
    return parsed.toISOString();
}

function normalizeCliSlug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9/]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .replace(/\/+/gu, '/');
}

function formatPage(page: ReturnType<typeof cortexPageSchema.parse>): string {
    return [
        `# ${page.title}`,
        '',
        `slug: ${page.slug}`,
        `type: ${page.type}`,
        page.tags.length > 0 ? `tags: ${page.tags.join(', ')}` : null,
        '',
        page.compiledTruth,
        '',
        page.body,
    ]
        .filter((line): line is string => line !== null)
        .join('\n');
}

function readGraphDirection(value: string): 'both' | 'in' | 'out' {
    if (value === 'in' || value === 'out' || value === 'both') {
        return value;
    }
    throw new Error('--direction must be out, in, or both.');
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
