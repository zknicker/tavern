export function shiftIsoDate(value: string, days: number) {
    return formatIsoDate(addDays(parseIsoDate(value), days));
}

export function addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + days);
    return nextDate;
}

export function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function parseIsoDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function formatIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateRangeEndpoint(value: string) {
    return fullNumericDateFmt.format(parseIsoDate(value));
}

const fullNumericDateFmt = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});
