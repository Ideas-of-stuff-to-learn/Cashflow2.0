import { NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED } from '../checkingName.js';

export function isStale(transaction, categoryNames) {
    if (!transaction.category) return false;
    if (transaction.category === NEEDS_MANUAL_REVIEW) return false;
    if (transaction.category === NOT_YET_CATEGORISED) return false;
    return !categoryNames.includes(transaction.category);
}

export function makeKey(t) {
    return `${t.description}|${t.date}|${t.amount}`;
}
