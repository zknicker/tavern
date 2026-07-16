import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KitCalendarDay, KitCalendarEvent } from './calendar.tsx';
import { KitChartStatus } from './chart-status.tsx';
import { KitBarChart } from './charts.tsx';
import { KitFrame } from './frame.tsx';
import { KitTable } from './table.tsx';

test('KitFrame renders the title header and framed content', () => {
    const markup = renderToStaticMarkup(
        <KitFrame size="full" title="Quarterly Revenue" titleAction={<button type="button" />}>
            body
        </KitFrame>
    );

    expect(markup).toContain('Quarterly Revenue');
    expect(markup).toContain('max-w-[46rem]');
    expect(markup).toContain('body');
});

test('KitFrame omits the header row without a title or action', () => {
    const markup = renderToStaticMarkup(<KitFrame>body</KitFrame>);

    expect(markup).toContain('max-w-[28rem]');
    expect(markup).not.toContain('<h3');
});

test('KitTable renders aligned columns and formatted cells', () => {
    const markup = renderToStaticMarkup(
        <KitTable
            columns={[
                { key: 'state', label: 'State' },
                { align: 'right', key: 'population', label: 'Population' },
            ]}
            rows={[
                { population: '39,538,223', state: 'California' },
                { population: null, state: true },
            ]}
        />
    );

    expect(markup).toContain('California');
    expect(markup).toContain('39,538,223');
    expect(markup).toContain('text-right tabular-nums');
    expect(markup).toContain('Yes');
});

test('KitBarChart renders a framed chart with legend values', () => {
    const markup = renderToStaticMarkup(
        <KitBarChart
            data={[
                { revenue: 12_000, quarter: 'Q1' },
                { revenue: 15_500, quarter: 'Q2' },
            ]}
            series={[{ key: 'revenue', label: 'Revenue' }]}
            title="Quarterly Revenue"
            unit="USD"
            xKey="quarter"
        />
    );

    expect(markup).toContain('Quarterly Revenue');
    expect(markup).toContain('$15,500');
    expect(markup).toContain('aspect-ratio:21 / 9');
});

test('KitCalendarEvent renders the date tile and time range', () => {
    const markup = renderToStaticMarkup(
        <KitCalendarEvent
            date="2026-07-04"
            endTime="10:30"
            location="Dock 3"
            startTime="09:00"
            title="Fireworks setup"
        />
    );

    expect(markup).toContain('Fireworks setup');
    expect(markup).toContain('9:00 - 10:30 AM');
    expect(markup).toContain('Dock 3');
});

test('KitCalendarDay renders event cards and the empty state', () => {
    const withEvents = renderToStaticMarkup(
        <KitCalendarDay date="2026-07-04" events={[{ allDay: true, title: 'Independence Day' }]} />
    );
    const empty = renderToStaticMarkup(<KitCalendarDay date="2026-07-04" events={[]} />);

    expect(withEvents).toContain('Independence Day');
    expect(withEvents).toContain('All day');
    expect(empty).toContain('No events scheduled.');
});

test('KitChartStatus styles the muted and error tones', () => {
    const muted = renderToStaticMarkup(<KitChartStatus text="Loading sales..." />);
    const error = renderToStaticMarkup(<KitChartStatus text="Request failed" tone="error" />);

    expect(muted).toContain('Loading sales...');
    expect(muted).toContain('text-muted-foreground');
    expect(error).toContain('text-destructive-foreground');
});
