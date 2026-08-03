// utils/categoryFilterToggle.js
//
// A plain empty Set already means "show everything" throughout this
// codebase (chart filtering, contents filtering). To represent "show
// NOTHING" as a genuinely separate state - not just another empty set,
// since that's already taken - we use a sentinel marker value that no
// real category name will ever equal. A Set containing ONLY this
// marker is non-empty (so it doesn't fall into the "show all" branch
// anywhere), but matches no real category (so nothing is visible).
export const SELECT_NONE_MARKER = '__SELECT_NONE__';

export function isShowingAll(selectedCategories) {
    return selectedCategories.size === 0;
}

// Called when the "All" control itself is clicked - toggles between
// showing everything (real empty set) and showing nothing (a set
// containing only the marker).
export function toggleAllCategories(selectedCategories) {
    return isShowingAll(selectedCategories)
        ? new Set([SELECT_NONE_MARKER])
        : new Set();
}

// Called whenever a SPECIFIC real category is toggled on/off - strips
// the marker out first if present, so selecting an individual category
// while in the "none" state correctly shows just that one category,
// with no leftover marker cluttering the set.
export function toggleSpecificCategory(selectedCategories, category) {
    const next = new Set(selectedCategories);
    next.delete(SELECT_NONE_MARKER);
    next.has(category) ? next.delete(category) : next.add(category);
    return next;
}