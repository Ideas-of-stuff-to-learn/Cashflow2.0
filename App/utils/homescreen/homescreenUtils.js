// Parses this app's stored DD/MM/YYYY date strings into real Date
// objects and finds the earliest/latest across every currently-loaded
// transaction, formatted as a readable "Month Year" range. For any row
// whose full date doesn't parse cleanly, still tries to salvage just
// the month/year portion (day can be garbage but month/year often
// still readable) so those can be listed by name rather than just
// counted. Returns null if there's no valid date data yet.
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

// Merges freshly parsed/categorized rows into whatever's already
// loaded (history from mount, or earlier uploads this session),
// matching by id - real database ids now (from parse_csv), so a
// transaction that already exists just gets its entry updated in
// place rather than duplicated, and unrelated existing rows are
// left untouched instead of being wiped out.
export function mergeById(prev, incoming) {
    const byId = new Map(prev.map(t => [t.id, t]));
    for (const t of incoming) {
        byId.set(t.id, t);
    }
    return Array.from(byId.values());
}
