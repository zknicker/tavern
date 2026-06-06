import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import entry from '../index.js';

describe('Tavern Cortex plugin entry', () => {
    it('registers as a standalone OpenClaw plugin', () => {
        expect(entry.id).toBe('tavern-cortex');
        expect(typeof entry.register).toBe('function');
    });

    it('ships Cortex skills through the plugin manifest', () => {
        const pluginRoot = path.resolve(import.meta.dirname, '..');
        const manifest = JSON.parse(
            fs.readFileSync(path.join(pluginRoot, 'openclaw.plugin.json'), 'utf8')
        );

        expect(manifest.skills).toEqual([
            'skills/cortex-query',
            'skills/cortex-capture',
            'skills/cortex-ingest',
            'skills/cortex-idea-ingest',
            'skills/cortex-media-ingest',
            'skills/cortex-enrich',
            'skills/cortex-source-enrich',
            'skills/cortex-organize',
            'skills/cortex-schema',
            'skills/cortex-citation-fixer',
            'skills/cortex-frontmatter-guard',
            'skills/cortex-taxonomist',
        ]);

        const querySkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-query/SKILL.md'),
            'utf8'
        );
        expect(querySkill).toContain('name: cortex-query');
        expect(querySkill).toContain('cortex_recall');
        expect(querySkill).toContain('cortex_list_backlinks');

        const captureSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-capture/SKILL.md'),
            'utf8'
        );
        expect(captureSkill).toContain('name: cortex-capture');
        expect(captureSkill).toContain('cortex_capture');
        expect(captureSkill).toContain('Cortex Chat Ingestion and');

        const ingestSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-ingest/SKILL.md'),
            'utf8'
        );
        expect(ingestSkill).toContain('name: cortex-ingest');
        expect(ingestSkill).toContain('cortex_import');
        expect(ingestSkill).toContain('cortex_ingest');
        expect(ingestSkill).toContain('cortex-idea-ingest');

        const ideaIngestSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-idea-ingest/SKILL.md'),
            'utf8'
        );
        expect(ideaIngestSkill).toContain('name: cortex-idea-ingest');
        expect(ideaIngestSkill).toContain('cortex_import');
        expect(ideaIngestSkill).toContain('cortex_ingest');
        expect(ideaIngestSkill).toContain('X posts');

        const mediaIngestSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-media-ingest/SKILL.md'),
            'utf8'
        );
        expect(mediaIngestSkill).toContain('name: cortex-media-ingest');
        expect(mediaIngestSkill).toContain('cortex_import');
        expect(mediaIngestSkill).toContain('cortex_ingest');
        expect(mediaIngestSkill).toContain('podcast');

        const enrichSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-enrich/SKILL.md'),
            'utf8'
        );
        expect(enrichSkill).toContain('name: cortex-enrich');
        expect(enrichSkill).toContain('cortex_edit');
        expect(enrichSkill).toContain('Enrichment Tiers');

        const sourceEnrichSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-source-enrich/SKILL.md'),
            'utf8'
        );
        expect(sourceEnrichSkill).toContain('name: cortex-source-enrich');
        expect(sourceEnrichSkill).toContain('cortex_edit');
        expect(sourceEnrichSkill).toContain('Executive Summary');

        const organizeSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-organize/SKILL.md'),
            'utf8'
        );
        expect(organizeSkill).toContain('name: cortex-organize');
        expect(organizeSkill).toContain('Cortex Organize Manifest');
        expect(organizeSkill).toContain('cortex_import');

        const schemaSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-schema/SKILL.md'),
            'utf8'
        );
        expect(schemaSkill).toContain('name: cortex-schema');
        expect(schemaSkill).toContain('adapted from GBrain `schema-author`');
        expect(schemaSkill).toContain('Propose new types from my corpus');
        expect(schemaSkill).toContain('make X an expert type');
        expect(schemaSkill).toContain('without user approval');
        expect(schemaSkill).toContain('Runtime records the schema addition automatically');
        expect(schemaSkill).toContain('lowercase kebab-case');

        const citationFixerSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-citation-fixer/SKILL.md'),
            'utf8'
        );
        expect(citationFixerSkill).toContain('name: cortex-citation-fixer');
        expect(citationFixerSkill).toContain('adapted from GBrain `citation-fixer`');
        expect(citationFixerSkill).toContain('Missing citations are flagged instead of invented');
        expect(citationFixerSkill).toContain('Never compose X/social URLs');

        const frontmatterGuardSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-frontmatter-guard/SKILL.md'),
            'utf8'
        );
        expect(frontmatterGuardSkill).toContain('name: cortex-frontmatter-guard');
        expect(frontmatterGuardSkill).toContain('adapted from GBrain `frontmatter-guard`');
        expect(frontmatterGuardSkill).toContain('Cortex lint');
        expect(frontmatterGuardSkill).toContain('cortex-schema');

        const taxonomistSkill = fs.readFileSync(
            path.join(pluginRoot, 'skills/cortex-taxonomist/SKILL.md'),
            'utf8'
        );
        expect(taxonomistSkill).toContain('name: cortex-taxonomist');
        expect(taxonomistSkill).toContain('adapted from GBrain `brain-taxonomist`');
        expect(taxonomistSkill).toContain('Where does this Cortex page go');
        expect(taxonomistSkill).toContain('active Cortex schema');
        expect(taxonomistSkill).toContain('Creating a page before searching Cortex');
    });
});
