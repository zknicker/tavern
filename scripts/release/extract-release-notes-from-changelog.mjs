#!/usr/bin/env node

import { fail, readFlagValue, readText } from './release-utils.mjs';

const argv = process.argv.slice(2);
const version = readFlagValue(argv, '--version');

if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
}

const main = async () => {
    const changelog = await readText('CHANGELOG.md');
    const notes = extractReleaseNotes(changelog, version);
    process.stdout.write(`${notes}\n`);
};

await main();

function printUsage() {
    console.log(
        [
            'Usage: bun run release:notes [-- --version X.Y.Z]',
            '',
            'Examples:',
            '  bun run release:notes',
            '  bun run release:notes -- --version 1.0.0',
        ].join('\n')
    );
}

function extractReleaseNotes(changelog, requestedVersion) {
    const headingPattern = /^## v(\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}$/gm;
    const headings = Array.from(changelog.matchAll(headingPattern));

    if (headings.length === 0) {
        fail('could not find any release headings in CHANGELOG.md');
    }

    const targetIndex = requestedVersion
        ? headings.findIndex((match) => match[1] === requestedVersion)
        : 0;

    if (targetIndex === -1) {
        fail(`could not find CHANGELOG.md entry for v${requestedVersion}`);
    }

    const start = headings[targetIndex].index + headings[targetIndex][0].length;
    const end =
        targetIndex + 1 < headings.length ? headings[targetIndex + 1].index : changelog.length;

    const notes = changelog.slice(start, end).trim();
    if (!notes) {
        const targetVersion = requestedVersion ?? headings[targetIndex][1];
        fail(`CHANGELOG.md entry for v${targetVersion} has no body`);
    }

    return notes;
}
