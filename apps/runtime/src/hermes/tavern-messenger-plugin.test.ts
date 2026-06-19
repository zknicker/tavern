import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    tavernRenderBarChartToolName,
    tavernRenderCalendarDayToolName,
    tavernRenderCalendarEventToolName,
    tavernRenderComposedChartToolName,
    tavernRenderLineChartToolName,
} from '@tavern/api';
import { describe, expect, it } from 'vitest';
import { tavernMessengerPluginSource } from './tavern-messenger-plugin';

describe('tavern messenger plugin', () => {
    it('registers OpenAI-compatible widget tool names', () => {
        const source = tavernMessengerPluginSource();

        expect(source).toContain(`"name": "${tavernRenderBarChartToolName}"`);
        expect(source).toContain(`name="${tavernRenderBarChartToolName}"`);
        expect(source).toContain(`"name": "${tavernRenderLineChartToolName}"`);
        expect(source).toContain(`name="${tavernRenderLineChartToolName}"`);
        expect(source).toContain(`"name": "${tavernRenderComposedChartToolName}"`);
        expect(source).toContain(`name="${tavernRenderComposedChartToolName}"`);
        expect(source).toContain(`"name": "${tavernRenderCalendarEventToolName}"`);
        expect(source).toContain(`name="${tavernRenderCalendarEventToolName}"`);
        expect(source).toContain(`"name": "${tavernRenderCalendarDayToolName}"`);
        expect(source).toContain(`name="${tavernRenderCalendarDayToolName}"`);
        expect(source).toContain('Render prepared categorical comparisons');
        expect(source).toContain('Render prepared ordered numeric data');
        expect(source).toContain('Render prepared ordered data as a composed chart');
        expect(source).toContain(
            'Render prepared ordered data as a composed bar and line chart in chat when totals and trend share one ordered axis'
        );
        expect(source).toContain(
            'Render one prepared single-day calendar event in chat, including simple when or where event answers'
        );
        expect(source).toContain('prepared calendar day or daily agenda');
        expect(source).toContain('Google Calendar event data');
        expect(source).toContain('numeric strings are normalized');
        expect(source).toContain('finite nonnegative JSON numbers; numeric strings are normalized');
        expect(source).toContain('finite JSON numbers; numeric strings are normalized');
        expect(tavernRenderBarChartToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
        expect(tavernRenderLineChartToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
        expect(tavernRenderComposedChartToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
        expect(tavernRenderCalendarEventToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
        expect(tavernRenderCalendarDayToolName).toMatch(/^[a-zA-Z0-9_-]+$/u);
    });

    it('validates chart tool input with the same boundary Runtime projects', async () => {
        const results = await runPluginValidator({
            extraRootField: {
                data: [{ quarter: 'Q1', revenue: 12_000 }],
                extra: true,
                title: 'Quarterly Revenue',
                x: 'quarter',
                y: 'revenue',
            },
            duplicateY: {
                data: [{ quarter: 'Q1', revenue: 12_000 }],
                title: 'Quarterly Revenue',
                x: 'quarter',
                y: ['revenue', 'revenue'],
            },
            multipleY: {
                data: [{ quarter: 'Q1', revenue: '12000', expenses: 7600 }],
                title: 'Quarterly Revenue',
                x: 'quarter',
                y: ['revenue', 'expenses'],
            },
            numericString: {
                data: [{ quarter: 'Q1', revenue: '12000' }],
                title: 'Quarterly Revenue',
                unit: 'USD',
                x: 'quarter',
                y: 'revenue',
            },
            underscoredNumericString: {
                data: [{ quarter: 'Q1', revenue: '1_000' }],
                title: 'Quarterly Revenue',
                x: 'quarter',
                y: 'revenue',
            },
        });

        expect(results.numericString).toEqual({ status: 'rendered' });
        expect(results.multipleY).toEqual({ status: 'rendered' });
        expect(results.extraRootField).toMatchObject({
            error: 'Input contains unsupported fields.',
        });
        expect(results.duplicateY).toMatchObject({
            error: 'y keys must be unique.',
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
                    title: 'Net Change',
                    x: 'month',
                    y: 'net',
                },
                underscoredNumericString: {
                    data: [{ month: 'Jan', net: '1_000' }],
                    title: 'Net Change',
                    x: 'month',
                    y: 'net',
                },
            },
            '_handle_tavern_render_line_chart'
        );

        expect(results.negativeNumericString).toEqual({ status: 'rendered' });
        expect(results.underscoredNumericString).toMatchObject({
            error: 'data[0].net must be a finite number or numeric string.',
        });
    });

    it('validates composed chart tool input with bar and line series', async () => {
        const results = await runPluginValidator(
            {
                duplicateAcrossSeries: {
                    barY: 'revenue',
                    data: [{ month: 'Jan', revenue: 120 }],
                    lineY: 'revenue',
                    title: 'Revenue and Profit',
                    x: 'month',
                },
                negativeLine: {
                    barY: 'revenue',
                    data: [{ month: 'Jan', profit: -2, revenue: 120 }],
                    lineY: 'profit',
                    title: 'Revenue and Profit',
                    x: 'month',
                },
                numericStrings: {
                    barY: 'revenue',
                    data: [{ month: 'Jan', profit: '31', revenue: '120' }],
                    lineY: 'profit',
                    title: 'Revenue and Profit',
                    unit: 'USD',
                    x: 'month',
                },
                tooManySeries: {
                    barY: ['one', 'two', 'three'],
                    data: [{ five: 5, four: 4, month: 'Jan', one: 1, three: 3, two: 2 }],
                    lineY: ['four', 'five'],
                    title: 'Too Many Series',
                    x: 'month',
                },
            },
            '_handle_tavern_render_composed_chart'
        );

        expect(results.numericStrings).toEqual({ status: 'rendered' });
        expect(results.duplicateAcrossSeries).toMatchObject({
            error: 'composed chart y keys must be unique.',
        });
        expect(results.negativeLine).toMatchObject({
            error: 'data[0].profit must be a finite nonnegative number or numeric string.',
        });
        expect(results.tooManySeries).toMatchObject({
            error: 'composed charts support up to 4 total series.',
        });
    });

    it('validates calendar event tool input', async () => {
        const results = await runPluginValidator(
            {
                allDayEvent: {
                    end: { date: '2026-06-21' },
                    start: { date: '2026-06-20' },
                    summary: 'Launch day',
                },
                impossibleDate: {
                    end: { date: '2026-03-01' },
                    start: { date: '2026-02-31' },
                    summary: 'Launch day',
                },
                multiDayAllDayEvent: {
                    end: { date: '2026-06-22' },
                    start: { date: '2026-06-20' },
                    summary: 'Launch window',
                },
                multiDayTimedEvent: {
                    end: {
                        dateTime: '2026-06-21T10:00:00-04:00',
                        timeZone: 'America/New_York',
                    },
                    start: {
                        dateTime: '2026-06-20T13:00:00-04:00',
                        timeZone: 'America/New_York',
                    },
                    summary: 'Launch window',
                },
                timedEvent: {
                    description: 'Review roadmap priorities and launch risks.',
                    end: {
                        dateTime: '2026-06-20T14:00:00-04:00',
                        timeZone: 'America/New_York',
                    },
                    location: 'Design room',
                    start: {
                        dateTime: '2026-06-20T13:00:00-04:00',
                        timeZone: 'America/New_York',
                    },
                    summary: 'Q1 roadmap review',
                },
            },
            '_handle_tavern_render_calendar_event'
        );

        expect(results.timedEvent).toEqual({ status: 'rendered' });
        expect(results.allDayEvent).toEqual({ status: 'rendered' });
        expect(results.impossibleDate).toMatchObject({
            error: 'start.date must be a real YYYY-MM-DD calendar date.',
        });
        expect(results.multiDayAllDayEvent).toMatchObject({
            error: 'Multi-day calendar events are not supported.',
        });
        expect(results.multiDayTimedEvent).toMatchObject({
            error: 'Multi-day calendar events are not supported.',
        });
    });

    it('validates calendar day tool input', async () => {
        const results = await runPluginValidator(
            {
                dayAgenda: {
                    date: '2026-06-20',
                    events: [
                        {
                            end: {
                                dateTime: '2026-06-20T12:45:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            start: {
                                dateTime: '2026-06-20T12:00:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            summary: 'Lunch',
                        },
                        {
                            end: {
                                dateTime: '2026-06-20T14:00:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            start: {
                                dateTime: '2026-06-20T13:00:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            summary: 'Q1 roadmap review',
                        },
                    ],
                    timezone: 'America/New_York',
                },
                wrongDay: {
                    date: '2026-06-20',
                    events: [
                        {
                            end: {
                                dateTime: '2026-06-21T11:00:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            start: {
                                dateTime: '2026-06-21T10:00:00-04:00',
                                timeZone: 'America/New_York',
                            },
                            summary: 'Next day review',
                        },
                    ],
                },
            },
            '_handle_tavern_render_calendar_day'
        );

        expect(results.dayAgenda).toEqual({ status: 'rendered' });
        expect(results.wrongDay).toMatchObject({
            error: 'events must match the calendar day date.',
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
