/* ─────────────────────────────────────────────────────────────────────────
   THEME — JS-facing colour exports.
   CSS tokens live in styles/theme.css.
   Swap the chart palette here when you're ready.
   ───────────────────────────────────────────────────────────────────────── */

export const ROLE_COLORS = {
    owner: '#C4A227',
    admin: '#2E5C8A',
};
export const DEFAULT_ROLE_COLOR = '#7A5C3D';

export const FALLBACK_CATEGORY_COLOR = '#BBBBBB';

/* 14-colour rotation for stacked bar segments.
   Replace these values to swap the chart palette. */
export const CHART_COLORS = [
    '#2E5C8A', '#E07A3E', '#3D8B5F', '#9B3D8A', '#C4A227',
    '#D94F4F', '#4FA8D9', '#7A5C3D', '#5C8A2E', '#D97AB8',
    '#3D5C8A', '#8A3D3D', '#4DBFBF', '#A67C52',
];

/* ── Theme init / toggle ─────────────────────────────────────────────── */

export function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    return next;
}

export function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}
