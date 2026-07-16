import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarDay, CalendarEvent } from './calendar.tsx';
import { Card } from './card.tsx';
import { ChartStatus } from './chart-status.tsx';
import { BarChart } from './charts.tsx';
import { Table } from './table.tsx';

test('Card renders the title header and framed content', () => {
    const markup = renderToStaticMarkup(
        <Card size="full" title="Quarterly Revenue" titleAction={<button type="button" />}>
            body
        </Card>
    );

    expect(markup).toContain('Quarterly Revenue');
    expect(markup).toContain('max-w-[46rem]');
    expect(markup).toContain('body');
});

test('Card omits the header row without a title or action', () => {
    const markup = renderToStaticMarkup(<Card>body</Card>);

    expect(markup).toContain('max-w-[28rem]');
    expect(markup).not.toContain('<h3');
});

test('Table renders aligned columns and formatted cells', () => {
    const markup = renderToStaticMarkup(
        <Table
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

test('Card composes with BarChart into a framed chart with legend values', () => {
    const markup = renderToStaticMarkup(
        <Card size="full" title="Quarterly Revenue">
            <BarChart
                data={[
                    { quarter: 'Q1', revenue: 12_000 },
                    { quarter: 'Q2', revenue: 15_500 },
                ]}
                series={[{ key: 'revenue', label: 'Revenue' }]}
                unit="USD"
                xKey="quarter"
            />
        </Card>
    );

    expect(markup).toContain('Quarterly Revenue');
    expect(markup).toContain('$15,500');
    expect(markup).toContain('aspect-ratio:21 / 9');
});

test('CalendarEvent renders the date tile and time range', () => {
    const markup = renderToStaticMarkup(
        <CalendarEvent
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

test('CalendarDay renders event cards and the empty state', () => {
    const withEvents = renderToStaticMarkup(
        <CalendarDay date="2026-07-04" events={[{ allDay: true, title: 'Independence Day' }]} />
    );
    const empty = renderToStaticMarkup(<CalendarDay date="2026-07-04" events={[]} />);

    expect(withEvents).toContain('Independence Day');
    expect(withEvents).toContain('All day');
    expect(empty).toContain('No events scheduled.');
});

test('ChartStatus styles the muted and error tones', () => {
    const muted = renderToStaticMarkup(<ChartStatus text="Loading sales..." />);
    const error = renderToStaticMarkup(<ChartStatus text="Request failed" tone="error" />);

    expect(muted).toContain('Loading sales...');
    expect(muted).toContain('text-muted-foreground');
    expect(error).toContain('text-destructive-foreground');
});
