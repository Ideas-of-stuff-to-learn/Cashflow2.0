/**
 * chartColors.js
 *
 * Per-theme colour palettes for the stacked bar chart.
 * Each array has 14 entries — one per category in display order.
 * Colours are assigned positionally: index 0 → category with display_order 1, etc.
 *
 * To use: import { THEME_CHART_COLORS } from './chartColors';
 * Read the active theme name at runtime via:
 *   getComputedStyle(document.documentElement).getPropertyValue('--theme-name').trim()
 * Then index into THEME_CHART_COLORS[themeName] to get the palette.
 *
 * EDITING GUIDE
 * ─────────────
 * Switch theme by changing active.css → @import './[theme].css'
 * Then open this file and adjust colours for that theme's section.
 * Hit "Apply theme palette" in Charts → Customise Category Colours to push to the DB.
 *
 * Each theme aims for:
 *   - visually distinct segments (no two adjacent colours too similar)
 *   - hue harmony with the theme's primary and background palette
 *   - enough contrast to read clearly on both light and dark backgrounds
 */

export const THEME_CHART_COLORS = {

  /* ── POLISHED — navy/steel, professional ──────────────────────────────── */
  polished: [
    '#2D4A8A', // navy — anchors the chart in the theme's primary
    '#D97840', // warm orange — strong contrast against navy
    '#2E7D52', // forest green
    '#8A4A96', // muted purple
    '#C4A030', // gold/amber
    '#C85A5A', // muted red
    '#3A9EC4', // sky blue
    '#7A6048', // warm brown
    '#4A8A2E', // olive green
    '#C47890', // dusty rose
    '#4A6E9E', // mid blue
    '#8A4040', // deep red
    '#3ABFB8', // teal
    '#9E7840', // dark gold
  ],

  /* ── WARM — terracotta/amber, personal ───────────────────────────────── */
  warm: [
    '#C26D3A', // terracotta — the theme's own primary
    '#3A6B47', // forest green — earthy contrast
    '#D4A02A', // amber/gold
    '#7A4E8A', // muted plum
    '#5A8A3A', // olive
    '#C85050', // deep red
    '#8A6A3A', // warm brown
    '#3A7A8A', // dusty teal
    '#C47040', // burnt orange (lighter)
    '#6A8A4A', // sage green
    '#A04A30', // brick red
    '#4A7A6A', // green-grey
    '#D48A4A', // pale amber
    '#7A4A40', // dark terracotta
  ],

  /* ── FOREST — deep green/sage, grounded ──────────────────────────────── */
  forest: [
    '#3A6B47', // deep green — theme primary
    '#C26D3A', // terracotta — warm contrast
    '#6A8A2E', // lime-olive
    '#5A4E8A', // muted indigo
    '#D4A02A', // gold
    '#C85050', // red
    '#4A8A6A', // mid green
    '#7A5C3D', // brown
    '#2E6B7A', // teal-green
    '#C47A70', // dusty salmon
    '#4A7A3A', // bright green
    '#8A6A3D', // warm tan
    '#3D8B78', // cool teal
    '#8A4040', // deep red
  ],

  /* ── CORAL — rose/coral, friendly ────────────────────────────────────── */
  coral: [
    '#D95F6A', // coral — theme primary
    '#3A6B47', // forest green — grounding contrast
    '#E07A3E', // warm orange
    '#5A4E8A', // muted indigo
    '#C4A030', // gold
    '#3D8B5F', // sage green
    '#D97898', // light rose
    '#7A5C3D', // brown
    '#4A8A6A', // teal-green
    '#9B6A8A', // muted mauve
    '#C85A40', // red-orange
    '#3D7A8A', // steel teal
    '#D4A870', // peach-gold
    '#5A7A3A', // olive
  ],

  /* ── MIDNIGHT — electric indigo, moody ───────────────────────────────── */
  midnight: [
    '#5B4ECC', // electric indigo — theme primary
    '#E07A3E', // orange — vivid contrast
    '#2E7D52', // green
    '#CC4E8A', // electric rose
    '#C4A030', // gold
    '#C85050', // red
    '#3A9EC4', // electric blue
    '#8A7A3D', // muted gold
    '#7A4ECC', // violet
    '#2E8B7A', // teal
    '#8A4E5A', // deep rose
    '#3A6A9E', // steel blue
    '#CC8A4E', // electric amber
    '#4A8A3A', // green
  ],
};

/**
 * Returns the colour palette for whichever CSS theme is currently active.
 * Falls back to 'polished' if the theme name isn't recognised.
 */
export function getActiveThemeChartColors() {
  const name = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-name')
    .trim();
  return THEME_CHART_COLORS[name] || THEME_CHART_COLORS.polished;
}
