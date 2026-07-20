import * as SecureStore from 'expo-secure-store';

const BASE_URL = "https://cashflow2-0.onrender.com";

// Fallback timeout if a caller doesn't specify one. Callers that care
// (useFileProcessor.js) pass their own timeoutMs tied to the backend's
// actual worker timeout - this is just a safety net for anything that
// doesn't.
const DEFAULT_REQUEST_TIMEOUT_MS = 110000;

// How long a normal (non-categorization) request waits before giving
// up with a user-friendly "server is starting up" message. Set to 70s
// to give Render's free tier enough room to cold-start (~30-60s
// typical) while still failing clearly rather than hanging forever.
// Distinct from DEFAULT_REQUEST_TIMEOUT_MS which is for categorization
// requests specifically, where the worker timeout governs timing.
const COLD_START_TIMEOUT_MS = 70000;

function now() {
    return (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
}

// Wraps fetch with a client-side timeout (AbortController) and reports
// how long the request actually took via onTiming, regardless of
// whether it succeeded, failed, or timed out.
//
// Why this exists: the backend's worker has its own hard timeout (see
// WORKER_TIMEOUT_SECONDS in useFileProcessor.js) - if it's exceeded,
// the worker gets killed mid-request with no graceful response at all,
// which just looks like a hung/dropped connection to us. Aborting
// client-side slightly BEFORE that happens means we get a clear,
// catchable timeout error instead of an ambiguous network failure, and
// callers can react to it deliberately (see useFileProcessor.js).
async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, onTiming) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = now();

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } catch (err) {
        if (err.name === 'AbortError') {
            const elapsedMs = now() - startedAt;
            const timeoutError = new Error(
                `Request to ${url} timed out after ${Math.round(elapsedMs)}ms (limit ${timeoutMs}ms)`
            );
            timeoutError.isTimeout = true;
            timeoutError.elapsedMs = elapsedMs;
            throw timeoutError;
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
        if (onTiming) onTiming(now() - startedAt);
    }
}

// Every endpoint below used to do `const data = await response.json()`
// directly. That's fine when the Flask app answers - but if the backend
// worker has crashed, is mid-restart, or the request hit a proxy-level
// error, Render's OWN infrastructure answers instead, with an HTML error
// page (starting with "<"), not JSON. JSON.parse on that throws a raw,
// confusing "Unexpected character: <" with no indication of what
// actually went wrong. This reads the body as text first, tries to
// parse it, and if that fails, throws a clear message describing what
// actually happened instead.
async function parseJsonResponse(response, fallbackMessage) {
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        if (response.status === 502 || response.status === 503) {
            throw new Error('The server is starting up or temporarily unavailable - please try again in a few seconds.');
        }
        throw new Error(`Unexpected server response (status ${response.status}) - please try again.`);
    }
    // flask_jwt_extended's OWN error responses (expired/invalid/revoked
    // token, missing fresh token) use a `msg` field, not `error` -
    // different from every route THIS app writes itself, which always
    // uses `error`. Falling back to `data.msg` here means a 401 from
    // the JWT layer itself ("Token has been revoked", "Fresh token
    // required", etc.) surfaces its own real reason instead of the
    // generic fallback message every caller passes in.
    if (!response.ok) throw new Error(data.error || data.msg || fallbackMessage);
    return data;
}

// --- Token storage ---
// Two tokens now, not one - see handoff6.txt. jwt_token is the
// short-lived (24h) ACCESS token sent on every normal request.
// jwt_refresh_token is the longer-lived (30 day) REFRESH token, only
// ever sent to /auth/refresh, used to silently obtain a new access
// token without asking for a password again.
async function storeTokens({ accessToken, refreshToken } = {}) {
    if (accessToken) await SecureStore.setItemAsync('jwt_token', accessToken);
    if (refreshToken) await SecureStore.setItemAsync('jwt_refresh_token', refreshToken);
}

async function getRefreshToken() {
    return await SecureStore.getItemAsync('jwt_refresh_token');
}

async function clearTokens() {
    await SecureStore.deleteItemAsync('jwt_token');
    await SecureStore.deleteItemAsync('jwt_refresh_token');
}

export async function getToken() {
    return await SecureStore.getItemAsync('jwt_token');
}

// Exchanges the stored refresh token for a new access token. Returns
// the new access token on success, or null if the refresh token itself
// was genuinely rejected (missing, expired, or revoked) - in which
// case both stored tokens are cleared, since a dead refresh token left
// sitting in SecureStore would just fail the exact same way again on
// the next attempt.
//
// A TRANSIENT failure (timeout, network error, backend unreachable)
// throws instead of returning null, with .isTransient set - this is
// the actual fix for a real bug: it used to return null for THIS case
// too, which authorizedFetch below then reported as "Not logged in" -
// wrong and misleading, since nothing about the person's login was
// actually invalid, the refresh request just couldn't complete. Now
// authorizedFetch can tell "genuinely logged out" apart from "server
// was briefly unreachable" and give an accurate, retry-worthy error
// for the latter instead.
async function tryRefreshAccessToken() {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    let response;
    try {
        response = await fetchWithTimeout(
            `${BASE_URL}/auth/refresh`,
            { method: 'POST', headers: { 'Authorization': `Bearer ${refreshToken}` } },
            COLD_START_TIMEOUT_MS,
        );
    } catch (e) {
        const transientError = new Error('Token refresh failed - server unreachable or timed out.');
        transientError.isTransient = true;
        throw transientError;
    }

    if (!response.ok) {
        await clearTokens();
        return null;
    }

    const data = await response.json();
    await storeTokens({ accessToken: data.access_token });
    return data.access_token;
}

// The one place every authenticated call in this file goes through.
// Attaches the current access token, makes the request, and if the
// backend answers 401 (expired access token, or revoked via
// /auth/logout or /admin/tokens/revoke), transparently tries ONE
// refresh-and-retry before giving up - the silent "stay logged in"
// behaviour this app relies on instead of asking for a password every
// 24 hours. Only throws "Not logged in" if that retry also fails,
// matching the exact message every existing caller already checks for
// - no call site elsewhere in this file needed to change its own
// error handling for this.
async function authorizedFetch(url, options = {}, timeoutMs, onTiming) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    // Always use fetchWithTimeout now - callers that explicitly pass
    // timeoutMs (categorization) get their own value; everything else
    // (categories, transactions, charts, auth/me, etc.) gets
    // COLD_START_TIMEOUT_MS. Before this change, callers that didn't
    // pass timeoutMs used plain fetch() with no timeout at all, so a
    // Render free-tier cold start (~30-60s) just hung silently with
    // no feedback and no way to recover. Now it fails clearly after
    // 70s with the message below, which the caller's own error
    // handling (typically a console.warn or a status text) surfaces
    // to the user.
    const effectiveTimeout = timeoutMs ?? COLD_START_TIMEOUT_MS;

    const withAuth = (t) => ({
        ...options,
        headers: { ...(options.headers || {}), 'Authorization': `Bearer ${t}` },
    });

    let response;
    try {
        response = await fetchWithTimeout(url, withAuth(token), effectiveTimeout, onTiming);
    } catch (err) {
        if (err.isTimeout) {
            throw new Error('The server is taking a while to start up - please wait a moment and try again.');
        }
        throw err;
    }

    if (response.status === 401) {
        let newAccessToken;
        try {
            newAccessToken = await tryRefreshAccessToken();
        } catch (err) {
            if (err.isTransient) {
                throw new Error('The server is taking a while to start up - please wait a moment and try again.');
            }
            throw err;
        }
        if (!newAccessToken) throw new Error('Not logged in');

        try {
            response = await fetchWithTimeout(url, withAuth(newAccessToken), effectiveTimeout, onTiming);
        } catch (err) {
            if (err.isTimeout) {
                throw new Error('The server is taking a while to start up - please wait a moment and try again.');
            }
            throw err;
        }
    }

    return response;
}

// Resets `color` back to `default_color` for the given category names -
// admin-only, same scoping convention as updateCategory (applies to a
// selected set, not the whole table). Returns the full refreshed
// category list, same shape as getCategories().
export async function resetCategoryDefaults(names) {
    const response = await authorizedFetch(`${BASE_URL}/categories/reset-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
    });

    return await parseJsonResponse(response, 'Reset to defaults failed');
}

// Total number of CSV files this user has ever uploaded - powers the
// "you've uploaded N files" summary on the home screen.
export async function getUploadCount() {
    const response = await authorizedFetch(`${BASE_URL}/uploads/count`, { method: 'GET' });

    const data = await parseJsonResponse(response, 'Failed to fetch upload count');
    return data.count;
}

export async function getCategories() {
    const response = await authorizedFetch(`${BASE_URL}/categories`, { method: 'GET' });

    const data = await parseJsonResponse(response, 'Failed to fetch categories');
    return data.categories;
}

export async function updateCategory(categoryName, { newName, color } = {}) {
    const body = { current_name: categoryName };
    if (newName) body.new_name = newName;
    if (color) body.color = color;

    // current_name now travels in the body, not the URL - some category
    // names contain a literal "/" (e.g. "Sports/Fitness"), and a
    // URL-encoded slash gets handled specially by a lot of web
    // infrastructure for security reasons, which meant it could get
    // rejected before Flask's own routing ever saw it - regardless of
    // encodeURIComponent on this end. Request bodies have no such
    // restriction on any character.
    const response = await authorizedFetch(`${BASE_URL}/categories`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    return await parseJsonResponse(response, 'Failed to update category');
}

// Without arguments: fetches all transactions in one shot (CLI callers,
// manageUserTransactionsAdmin.py, etc. - the old behaviour preserved).
// With { offset, limit }: fetches one page and returns
// { transactions, total, offset, limit } so the caller knows the full
// count and can loop for subsequent pages.
export async function getTransactionHistory({ offset, limit } = {}) {
    const params = new URLSearchParams();
    if (offset !== undefined) params.set('offset', offset);
    if (limit !== undefined) params.set('limit', limit);
    const qs = params.toString();

    const response = await authorizedFetch(
        `${BASE_URL}/transactions${qs ? '?' + qs : ''}`,
        { method: 'GET' },
    );

    const data = await parseJsonResponse(response, 'Failed to fetch transaction history');
    // Paginated call: return the full envelope so caller has total/offset/limit.
    // Non-paginated call: return just the array, same as before.
    return limit !== undefined ? data : data.transactions;
}

export async function deleteTransactions(ids) {
    const response = await authorizedFetch(`${BASE_URL}/transactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });

    const data = await parseJsonResponse(response, 'Delete failed');
    return data.deleted;
}

export async function signup(username, password) {
    const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse(response, 'Signup failed');
    await storeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
    return data.access_token;
}

export async function login(username, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse(response, 'Login failed');
    await storeTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
    return data.access_token;
}

// Returns { username, role, level, permissions } for whoever the
// current token belongs to. Used by AppContext to decide whether to
// show the role badge (RoleBadge.js) - a plain 'user' (level 0) sees
// nothing different; anything above that shows their role name top
// right of every screen. Also usable by future admin-facing screens
// that need to know "am I even allowed to see this control."
export async function getMe() {
    const response = await authorizedFetch(`${BASE_URL}/auth/me`, { method: 'GET' });

    return await parseJsonResponse(response, 'Failed to fetch account info');
}

// Actually revokes the current session server-side now (see
// handoff5.txt/handoff6.txt for why the OLD logout() - which only ever
// cleared local SecureStore - was never enough on its own). Sends the
// stored refresh token along in the body too, so ONE call revokes both
// halves of the session; the backend independently verifies that
// token's signature before touching it; a missing or already-invalid
// refresh token doesn't fail the whole logout, it's silently skipped
// server-side.
//
// Deliberately best-effort: if the network call fails outright (no
// connectivity), local tokens are STILL cleared - the device should
// always be able to "forget" its own session even if it can't reach
// the backend to un-issue it, so the person is never stuck unable to
// log out just because they're offline.
// Clears local tokens immediately (so the UI responds instantly - no
// waiting on a network call), then fires the server-side revocation in
// the background without awaiting it. The server call is best-effort:
// if it fails (offline, cold start, whatever), the tokens are already
// gone from this device so the session is practically dead anyway -
// the revoked_tokens table entry just won't exist, meaning the token
// could theoretically still work from somewhere else that has a copy,
// but that's an acceptable tradeoff for an instant logout experience
// versus the old behaviour of waiting for the round-trip first.
export async function logout() {
    // Read both tokens before clearing them - we need them for the
    // background revocation call, but we clear first so the UI is
    // unblocked immediately.
    const token = await getToken();
    const refreshToken = await getRefreshToken();

    // Clear first - instant.
    await clearTokens();

    // Revoke in the background. No await, no try/catch needed here -
    // it's fire-and-forget. A failure silently does nothing, which is
    // fine: the tokens are already gone from this device.
    if (token) {
        fetch(`${BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
        }).catch(() => {});
    }
}

export async function categorizeCached(transactions, { timeoutMs, onTiming } = {}) {
    const response = await authorizedFetch(`${BASE_URL}/categorize/cached`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
    }, timeoutMs, onTiming);

    const data = await parseJsonResponse(response, 'Cache lookup failed');
    return data.transactions;
}

// Three separate calls, one per cache-tier phase (exact -> merchant ->
// similarity), instead of the single combined categorizeCached() above.
// Each is its own round trip so the caller (useFileProcessor.js) can
// apply a phase's results - and let the person SEE them - as soon as
// they land, rather than waiting for all three tiers to finish before
// anything updates. Same request/response shape as categorizeCached,
// just three thinner slices of the same underlying work.
export async function categorizeCachedExact(transactions, { timeoutMs, onTiming } = {}) {
    const response = await authorizedFetch(`${BASE_URL}/categorize/cached/exact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
    }, timeoutMs, onTiming);

    const data = await parseJsonResponse(response, 'Exact cache lookup failed');
    return data.transactions;
}

export async function categorizeCachedMerchant(transactions, { timeoutMs, onTiming } = {}) {
    const response = await authorizedFetch(`${BASE_URL}/categorize/cached/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
    }, timeoutMs, onTiming);

    const data = await parseJsonResponse(response, 'Merchant lookup failed');
    return data.transactions;
}

export async function categorizeCachedSimilarity(transactions, { timeoutMs, onTiming } = {}) {
    const response = await authorizedFetch(`${BASE_URL}/categorize/cached/similarity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
    }, timeoutMs, onTiming);

    const data = await parseJsonResponse(response, 'Similarity lookup failed');
    return data.transactions;
}

export async function categorizeLLM(transactions, { timeoutMs, onTiming, batchSize, geminiTimeoutMs } = {}) {
    const body = { transactions };
    // Real, server-side Gemini batch size (unique descriptions per LLM
    // call inside run_llm_tier) - this is the actual thing that used
    // to be a fixed default of 200 on the backend. Passed through only
    // if the caller specifies it; backend falls back to its own
    // default otherwise.
    if (batchSize != null) body.batch_size = batchSize;
    // Real, server-side per-call Gemini timeout (milliseconds) - how
    // long the BACKEND waits on its own outbound call to Gemini before
    // giving up. Not the same thing as this function's own `timeoutMs`
    // (that's how long THIS APP waits for a response from our
    // backend). See GEMINI_REQUEST_TIMEOUT_MS in useFileProcessor.js.
    if (geminiTimeoutMs != null) body.gemini_timeout_ms = geminiTimeoutMs;

    const response = await authorizedFetch(`${BASE_URL}/categorize/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, timeoutMs, onTiming);

    const data = await parseJsonResponse(response, 'LLM categorisation failed');
    return data.transactions;
}

export async function parseCSVFiles(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', {
            uri: file.uri,
            name: file.name,
            type: 'text/csv',
        });
    }

    const response = await authorizedFetch(`${BASE_URL}/api/parse-csv`, {
        method: 'POST',
        // DO NOT set Content-Type manually here - React Native sets it
        // automatically with the correct multipart boundary when
        // you pass FormData. Setting it manually breaks it.
        body: formData,
    });

    const data = await parseJsonResponse(response, 'Failed to parse CSV');
    return data.transactions;
}

export async function categorizeTransactions(transactions) {
    const response = await authorizedFetch(`${BASE_URL}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
    });

    const data = await parseJsonResponse(response, 'Categorization failed');
    return data.transactions;
}

export async function resolveCategories(resolutions) {
    const response = await authorizedFetch(`${BASE_URL}/categorize/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutions }),
    });

    return await parseJsonResponse(response, 'Resolve failed');
}

// Pre-aggregated (year, category) and (year, month, category) sums for
// the Charts screen - computed inside Postgres, not client-side, so the
// payload stays small (bounded by years x months x categories) no
// matter how much raw transaction history has accumulated. Returns
// { yearly: [...], monthly: [...] }.
export async function getChartSummary() {
    const response = await authorizedFetch(`${BASE_URL}/charts/summary`, { method: 'GET' });

    return await parseJsonResponse(response, 'Failed to fetch chart summary');
}