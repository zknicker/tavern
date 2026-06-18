import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tavernRenderBarChartToolName, tavernRenderLineChartToolName } from '@tavern/api';
import { describe, expect, it } from 'vitest';
import { tavernMessengerPluginSource } from './tavern-messenger-plugin';

describe('tavern messenger plugin', () => {
    it('registers OpenAI-compatible widget tool names', () => {
        const source = tavernMessengerPluginSource();

        expect(source).toContain(`"name": "${tavernRenderBarChartToolName}"`);
        expect(source).toContain(`name="${tavernRenderBarChartToolName}"`);
        expect(source).toContain(`"name": "${tavernRenderLineChartToolName}"`);
        expect(source).toContain(`name="${tavernRenderLineChartToolName}"`);
        expect(source).toContain('Use when the user asks to see prepared categorical data');
        expect(source).toContain('Use when the user asks to see prepared numeric data');
        expect(source).toContain('numeric strings are normalized');
        expect(source).toContain('finite nonnegative JSON number or numeric string');
        expect(source).toContain('finite JSON number or numeric string');
        expect(tavernRenderBarChartToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
        expect(tavernRenderLineChartToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
    });

    it('validates chart tool input with the same boundary Runtime projects', async () => {
        const results = await runPluginValidator({
            extraRootField: {
                data: [{ quarter: 'Q1', revenue: 12_000 }],
                extra: true,
                series: [{ key: 'revenue', label: 'Revenue' }],
                title: 'Quarterly Revenue',
                xKey: 'quarter',
            },
            extraSeriesField: {
                data: [{ quarter: 'Q1', revenue: 12_000 }],
                series: [{ color: 'red', key: 'revenue', label: 'Revenue' }],
                title: 'Quarterly Revenue',
                xKey: 'quarter',
            },
            numericString: {
                data: [{ quarter: 'Q1', revenue: '12000' }],
                series: [{ key: 'revenue', label: 'Revenue' }],
                title: 'Quarterly Revenue',
                xKey: 'quarter',
            },
            underscoredNumericString: {
                data: [{ quarter: 'Q1', revenue: '1_000' }],
                series: [{ key: 'revenue', label: 'Revenue' }],
                title: 'Quarterly Revenue',
                xKey: 'quarter',
            },
        });

        expect(results.numericString).toEqual({ status: 'rendered' });
        expect(results.extraRootField).toMatchObject({
            error: 'Input contains unsupported fields.',
        });
        expect(results.extraSeriesField).toMatchObject({
            error: 'Series entries contain unsupported fields.',
        });
        expect(results.underscoredNumericString).toMatchObject({
            error: 'data[0].revenue must be a finite nonnegative number or numeric string.',
        });
    });

    it('validates line chart tool input with signed numeric values', async () => {
        const results = await runPluginValidator(
            {
                negativeNumericString: {
                    data: [{ month: 'Jan', net: '-12.5' }],
                    series: [{ key: 'net', label: 'Net' }],
                    title: 'Net Change',
                    xKey: 'month',
                },
                underscoredNumericString: {
                    data: [{ month: 'Jan', net: '1_000' }],
                    series: [{ key: 'net', label: 'Net' }],
                    title: 'Net Change',
                    xKey: 'month',
                },
            },
            '_handle_tavern_render_line_chart'
        );

        expect(results.negativeNumericString).toEqual({ status: 'rendered' });
        expect(results.underscoredNumericString).toMatchObject({
            error: 'data[0].net must be a finite number or numeric string.',
        });
    });
});

async function runPluginValidator(
    cases: Record<string, unknown>,
    handlerName = '_handle_tavern_render_bar_chart'
) {
    const dir = await mkdtemp(path.join(tmpdir(), 'tavern-plugin-test-'));

    try {
        await Promise.all([
            mkdir(path.join(dir, 'gateway', 'platforms'), { recursive: true }),
            mkdir(path.join(dir, 'tools'), { recursive: true }),
        ]);
        await Promise.all([
            writeFile(path.join(dir, 'gateway', '__init__.py'), ''),
            writeFile(
                path.join(dir, 'gateway', 'config.py'),
                'class Platform:\n    def __init__(self, name):\n        self.name = name\n\nclass PlatformConfig:\n    pass\n'
            ),
            writeFile(path.join(dir, 'gateway', 'platforms', '__init__.py'), ''),
            writeFile(
                path.join(dir, 'gateway', 'platforms', 'base.py'),
                'class BasePlatformAdapter:\n    def __init__(self, **kwargs):\n        pass\n    def _mark_connected(self):\n        pass\n    def _mark_disconnected(self):\n        pass\n\nclass SendResult:\n    def __init__(self, **kwargs):\n        self.__dict__.update(kwargs)\n'
            ),
            writeFile(path.join(dir, 'tools', '__init__.py'), ''),
            writeFile(
                path.join(dir, 'tools', 'registry.py'),
                'import json\n\ndef tool_error(error):\n    return json.dumps({"error": error})\n\ndef tool_result(result):\n    return json.dumps(result)\n'
            ),
            writeFile(path.join(dir, 'tavern_plugin.py'), tavernMessengerPluginSource()),
            writeFile(path.join(dir, 'cases.json'), JSON.stringify(cases)),
        ]);

        const output = execFileSync(
            'python3',
            [
                '-c',
                [
                    'import json',
                    'import tavern_plugin',
                    'with open("cases.json", "r", encoding="utf-8") as f:',
                    '    cases = json.load(f)',
                    `handler = getattr(tavern_plugin, "${handlerName}")`,
                    'results = {name: json.loads(handler(value)) for name, value in cases.items()}',
                    'print(json.dumps(results))',
                ].join('\n'),
            ],
            { cwd: dir, encoding: 'utf8' }
        );

        return JSON.parse(output) as Record<string, unknown>;
    } finally {
        await rm(dir, { force: true, recursive: true });
    }
}
