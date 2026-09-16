# Cashflow 2.0 — Task Backlog

> Edit this file directly to update task status, add notes, or reprioritise.
> Status: `[ ]` open · `[x]` done · `[-]` in progress · `[~]` blocked

---

## UI / Bug Fixes

- [ ] **Category list vanishing on "Remember this order"**
  Investigate why the category list disappears when the remember-order button is pressed. Likely a state update wiping the rendered list before the save completes.

- [ ] **Font, size and colour palette audit**
  Check consistency across all three surfaces — dashboard (web), phone mimic, and React Native. Document any mismatches and agree a single source of truth.

- [ ] **Dashboard: no page scroll**
  The dashboard should fit entirely within the viewport with zero window-level scroll. Includes making sure the legal page footer links do not push content out of the viewport.

---

## Popups & Info

- [ ] **Convert footnote box → "User Information" popup**
  Replace the current footnote box with a popup modal triggered by a prominent `ℹ` symbol (similar to the one on the Transactions page but more visible). Label: *User Information*.

- [ ] **Add "Data Security" popup**
  Add a second popup triggered by a 🔒 lock symbol. Content: a copy of `docs/data-security.html` embedded or linked inside the modal, editable by the client on request. This popup (and the User Information popup) should also surface links to the legal pages (Privacy, Terms, Accessibility, Cookies).

---

## React Native

- [ ] **Bring React Native up to date**
  Review dependencies against Expo SDK 54 docs (`docs.expo.dev/versions/v54.0.0/`). Update packages, resolve any breaking changes, and verify the app builds cleanly on iOS and Android.

- [ ] **React Native: hard testing**
  Full manual test of all React Native screens after the update. Cover: login, upload, categorisation flow, charts, manual review, edge cases (empty state, offline, large file).

---

## Testing

- [ ] **Hard testing — dashboard, phone mimic, React Native**
  Structured manual test pass across all three surfaces. Cover the golden path end-to-end plus known fragile areas: virtualiser, column resize, manual review flush, preferences persistence, cold-start spinner.

- [ ] **Full automated test suite**
  Design and implement automated tests for the whole app. Agree scope first (unit, integration, E2E, or all three), tooling choices, and what counts as a passing suite before writing any tests.
  > ⚠️ Note: no test framework currently exists — see `context/constraints.md`. This task requires explicit owner sign-off on scope before work begins.

---

## Notes

- Tasks are in rough priority order within each section but can be reordered freely.
- "Hard testing" (#7) should happen after React Native is updated (#3) and after the popup work (#4, #5) is complete.
- Automated testing (#8) is a substantial scoping exercise before it becomes a coding task.
