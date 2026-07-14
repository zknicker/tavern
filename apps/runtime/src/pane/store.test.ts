import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    ChatPaneRevisionConflictError,
    getChatPaneState,
    openChatPaneTarget,
    setChatPaneState,
} from './store.ts';

const wikiTarget = { kind: 'wikiPage', path: 'Demos/Panel Brief.md' } as const;
const fileTarget = { kind: 'workspaceFile', path: 'workbench/out/report.html' } as const;

describe('chat pane store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    test('defaults to an empty revision-0 state', () => {
        expect(getChatPaneState('cht_1')).toEqual({
            activeKey: null,
            chatId: 'cht_1',
            revision: 0,
            targets: [],
            updatedAt: null,
        });
    });

    test('set replaces state and bumps the revision', () => {
        const state = setChatPaneState('cht_1', {
            activeKey: 'wikiPage:Demos/Panel Brief.md',
            expectedRevision: 0,
            targets: [wikiTarget],
        });

        expect(state.revision).toBe(1);
        expect(state.targets).toEqual([wikiTarget]);
        expect(getChatPaneState('cht_1')).toEqual(state);
    });

    test('set rejects a stale revision with the current state attached', () => {
        setChatPaneState('cht_1', {
            activeKey: null,
            expectedRevision: 0,
            targets: [wikiTarget],
        });

        let conflict: ChatPaneRevisionConflictError | null = null;
        try {
            setChatPaneState('cht_1', {
                activeKey: null,
                expectedRevision: 0,
                targets: [],
            });
        } catch (error) {
            conflict = error as ChatPaneRevisionConflictError;
        }

        expect(conflict).toBeInstanceOf(ChatPaneRevisionConflictError);
        expect(conflict?.current.revision).toBe(1);
        expect(conflict?.current.targets).toEqual([wikiTarget]);
    });

    test('set rejects an activeKey that references no submitted target', () => {
        expect(() =>
            setChatPaneState('cht_1', {
                activeKey: 'workspaceFile:missing.md',
                expectedRevision: 0,
                targets: [wikiTarget],
            })
        ).toThrow(/activeKey/);
    });

    test('open appends and focuses a new target without a revision check', () => {
        setChatPaneState('cht_1', {
            activeKey: 'wikiPage:Demos/Panel Brief.md',
            expectedRevision: 0,
            targets: [wikiTarget],
        });

        const state = openChatPaneTarget('cht_1', fileTarget);

        expect(state.revision).toBe(2);
        expect(state.targets).toEqual([wikiTarget, fileTarget]);
        expect(state.activeKey).toBe('workspaceFile:workbench/out/report.html');
    });

    test('open focuses an existing target without duplicating it', () => {
        setChatPaneState('cht_1', {
            activeKey: 'workspaceFile:workbench/out/report.html',
            expectedRevision: 0,
            targets: [wikiTarget, fileTarget],
        });

        const state = openChatPaneTarget('cht_1', wikiTarget);

        expect(state.targets).toEqual([wikiTarget, fileTarget]);
        expect(state.activeKey).toBe('wikiPage:Demos/Panel Brief.md');
    });

    test('states are isolated per chat', () => {
        openChatPaneTarget('cht_1', wikiTarget);

        expect(getChatPaneState('cht_2').targets).toEqual([]);
    });
});
