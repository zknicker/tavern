import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { VaultSettingsCard } from './page.tsx';

test('VaultSettingsCard renders path setting and Vault status', () => {
    const markup = renderToStaticMarkup(
        <VaultSettingsCard
            isSaving={false}
            onSave={() => undefined}
            settings={{
                configSource: 'settings',
                configuredPath: '~/wiki',
                effectivePath: '/Users/zknicker/wiki',
                environmentPath: null,
                updatedAt: '2026-06-17T12:00:00.000Z',
            }}
            status={{
                configSource: 'settings',
                freshness: {
                    live: true,
                    reason: null,
                    state: 'watching',
                },
                indexExists: true,
                pageCount: 42,
                readable: true,
                vaultPath: '/Users/zknicker/wiki',
                writable: true,
            }}
        />
    );

    assert.match(markup, /Vault path/);
    assert.match(markup, /Effective path/);
    assert.match(markup, /Settings/);
    assert.match(markup, /Markdown pages/);
    assert.match(markup, /INDEX.md/);
    assert.doesNotMatch(markup, /Active topics/);
    assert.doesNotMatch(markup, /Runtime crons/);
});
