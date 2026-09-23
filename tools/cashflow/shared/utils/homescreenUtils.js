export function getDateRangeInfo(transactions) {
    if (!transactions || transactions.length === 0) return null;

    let earliest = null;
    let latest = null;
    const skippedMonthYears = new Set();

    for (const t of transactions) {
        if (!t.date) continue;
        const [dd, mm, yyyy] = t.date.split('/');
        const d = new Date(yyyy, mm - 1, dd);

        if (isNaN(d.getTime())) {
            const monthNum = parseInt(mm, 10);
            const yearNum = parseInt(yyyy, 10);
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && !isNaN(yearNum)) {
                const label = new Date(yearNum, monthNum - 1, 1)
                    .toLocaleString('default', { month: 'long', year: 'numeric' });
                skippedMonthYears.add(label);
            }
            continue;
        }

        if (!earliest || d < earliest) earliest = d;
        if (!latest || d > latest) latest = d;
    }

    if (!earliest || !latest) return null;

    const format = (d) => d.toLocaleString('default', { month: 'long', year: 'numeric' });
    return {
        rangeText: `${format(earliest)} – ${format(latest)}`,
        skippedMonthYears: Array.from(skippedMonthYears),
    };
}

export function mergeById(prev, incoming) {
    const byId = new Map(prev.map(t => [t.id, t]));
    for (const t of incoming) {
        byId.set(t.id, t);
    }
    return Array.from(byId.values());
}

export function chunkArray(items, size) {
    if (size <= 0) return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
