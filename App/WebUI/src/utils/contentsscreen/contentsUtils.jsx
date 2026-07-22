import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../../checkingName';

// A transaction is "stale" if it carries a category name that no longer
// exists in the current category list (renamed/combined/deleted since
// this transaction was last categorised). The two sentinel states are
// deliberately excluded - neither is a real category name, so neither
// should ever be flagged as a desync against categoryNames.
export function isStale(transaction, categoryNames) {
    if (!transaction.category) return false;
    if (transaction.category === NEEDS_MANUAL_REVIEW) return false;
    if (transaction.category === NOT_YET_CATEGORISED) return false;
    return !categoryNames.includes(transaction.category);
}

// Identity key used to match a transaction against the backend's
// "skipped" list after a resolve call - same shape the backend itself
// uses to report which rows were out of sync.
export function makeKey(t) {
    return `${t.description}|${t.date}|${t.amount}`;
}

export const ROW_HEIGHT = 46;
