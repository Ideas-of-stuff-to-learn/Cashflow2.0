const NEEDS_MANUAL_REVIEW = "MANUALLY CATEGORISE"

// Distinct from NEEDS_MANUAL_REVIEW: this marks a transaction that
// simply never got a chance to be looked at, because a categorisation
// request timed out client-side (see useFileProcessor.js) before the
// backend could finish and respond. Nothing has judged this
// transaction ambiguous or hard - it just ran out of time. It should
// be retried later (e.g. by re-running categorisation on it), NOT
// surfaced to the user as something THEY need to manually pick a
// category for - that's what NEEDS_MANUAL_REVIEW is for.
const NOT_YET_CATEGORISED = "NOT YET CATEGORISED"


export {NEEDS_MANUAL_REVIEW, NOT_YET_CATEGORISED};