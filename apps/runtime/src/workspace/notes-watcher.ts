import { type FSWatcher, watch } from 'node:fs';
import path from 'node:path';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { generateAgentInstructions, getAgentWorkspaceSource } from './instructions.ts';
import { agentNotesFileName } from './managed-instructions.ts';

interface NotesWatcher {
    watcher: FSWatcher;
    workspaceDir: string;
}

const watchers = new Map<string, NotesWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const debounceMs = 300;

/**
 * Watch the agent's NOTES.md so direct file-tool edits refresh rendered
 * system-prompt metadata without waiting for the next sync. Watching the workspace directory (not
 * the file) survives editors that replace the file. Safe to call repeatedly;
 * the watcher is replaced when the workspace moves.
 */
export function ensureAgentNotesWatcher(db: Database, agentId: string) {
    const source = getAgentWorkspaceSource(db, agentId);
    if (!source) {
        return;
    }

    const current = watchers.get(agentId);
    if (current?.workspaceDir === source.workspaceDir) {
        return;
    }
    current?.watcher.close();

    let watcher: FSWatcher;
    try {
        watcher = watch(source.workspaceDir, (_eventType, fileName) => {
            if (fileName !== agentNotesFileName) {
                return;
            }
            scheduleGenerate(db, agentId);
        });
    } catch (err) {
        log.error('Agent notes watcher could not start; NOTES.md edits apply on next sync', {
            agentId,
            err,
            workspaceDir: source.workspaceDir,
        });
        return;
    }

    watcher.on('error', (err) => {
        log.error('Agent notes watcher failed; NOTES.md edits apply on next sync', {
            agentId,
            err,
        });
        watchers.delete(agentId);
    });
    watchers.set(agentId, { watcher, workspaceDir: source.workspaceDir });
    log.info('Watching agent notes for instruction regeneration', {
        agentId,
        notesPath: path.join(source.workspaceDir, agentNotesFileName),
    });
}

export function closeAgentNotesWatchers() {
    for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
    }
    debounceTimers.clear();
    for (const { watcher } of watchers.values()) {
        watcher.close();
    }
    watchers.clear();
}

function scheduleGenerate(db: Database, agentId: string) {
    const pending = debounceTimers.get(agentId);
    if (pending) {
        clearTimeout(pending);
    }
    debounceTimers.set(
        agentId,
        setTimeout(() => {
            debounceTimers.delete(agentId);
            generateAgentInstructions(db, agentId).catch((err) => {
                log.error('Refreshing system prompt from NOTES.md failed', { agentId, err });
            });
        }, debounceMs)
    );
}
