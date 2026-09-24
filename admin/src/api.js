const BASE_URL = import.meta.env.PROD
    ? 'https://cashflow2-0.onrender.com'
    : `http://${import.meta.env.VITE_LOCAL_IP || 'localhost'}:5000`;

const DEFAULT_TIMEOUT_MS = 110000;

let csrfAccessToken = null;
let csrfRefreshToken = null;

async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') {
            const e = new Error(`Request timed out after ${timeoutMs}ms`);
            e.isTimeout = true;
            throw e;
        }
        throw err;
    } finally {
        clearTimeout(id);
    }
}

async function parseJson(response, fallback) {
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
        if (response.status === 502 || response.status === 503)
            throw new Error('Server is starting up — please try again in a few seconds.');
        throw new Error(`Unexpected server response (status ${response.status})`);
    }
    if (!response.ok) throw new Error(data.error || data.msg || fallback);
    return data;
}

let refreshPromise = null;

async function tryRefresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        try {
            const r = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'X-CSRF-TOKEN': csrfRefreshToken },
            }, 70000);
            if (r.ok) {
                const d = await r.json();
                csrfAccessToken = d.csrf_access_token;
            } else {
                window.dispatchEvent(new CustomEvent('auth:session-expired'));
            }
            return r.ok;
        } finally {
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}

async function authFetch(url, options = {}) {
    let r = await fetchWithTimeout(url, {
        ...options,
        credentials: 'include',
        headers: { ...options.headers, 'X-CSRF-TOKEN': csrfAccessToken },
    });
    if (r.status === 401) {
        const ok = await tryRefresh();
        if (!ok) throw new Error('Not logged in');
        r = await fetchWithTimeout(url, {
            ...options,
            credentials: 'include',
            headers: { ...options.headers, 'X-CSRF-TOKEN': csrfAccessToken },
        });
    }
    return r;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(identifier, password) {
    const field = identifier.includes('@') ? 'email' : 'username';
    const r = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: identifier, password, website: '' }),
    }, 70000);
    const d = await parseJson(r, 'Login failed');
    csrfAccessToken = d.csrf_access_token;
    csrfRefreshToken = d.csrf_refresh_token;
    return d;
}

export async function signup(username, password, email) {
    const body = { username, password };
    if (email) body.email = email;
    const r = await fetchWithTimeout(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }, 70000);
    const d = await parseJson(r, 'Signup failed');
    csrfAccessToken = d.csrf_access_token;
    csrfRefreshToken = d.csrf_refresh_token;
    return d;
}

export async function logout() {
    await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-TOKEN': csrfAccessToken },
    }).catch(() => {});
    csrfAccessToken = null;
    csrfRefreshToken = null;
}

export async function forgotPassword(email) {
    const r = await fetchWithTimeout(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website: '' }),
    }, 30000);
    return parseJson(r, 'Request failed');
}

export async function getMe() {
    const r = await authFetch(`${BASE_URL}/auth/me`, { method: 'GET' });
    const d = await parseJson(r, 'Failed to fetch account info');
    if (d.csrf_access_token) csrfAccessToken = d.csrf_access_token;
    if (d.csrf_refresh_token) csrfRefreshToken = d.csrf_refresh_token;
    return d;
}

// ── Admin — permissions/roles ─────────────────────────────────────────────────

export async function getPermissions() {
    const r = await authFetch(`${BASE_URL}/admin/permissions`);
    return (await parseJson(r, 'Failed to fetch permissions')).permissions;
}

export async function getRoles() {
    const r = await authFetch(`${BASE_URL}/admin/roles`);
    return (await parseJson(r, 'Failed to fetch roles')).roles;
}

export async function createRole(name, level, permissions) {
    const r = await authFetch(`${BASE_URL}/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level, permissions }),
    });
    return (await parseJson(r, 'Failed to create role')).role;
}

export async function updateRole(roleId, fields) {
    const r = await authFetch(`${BASE_URL}/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
    });
    return (await parseJson(r, 'Failed to update role')).role;
}

export async function deleteRole(roleId) {
    const r = await authFetch(`${BASE_URL}/admin/roles/${roleId}`, { method: 'DELETE' });
    return parseJson(r, 'Failed to delete role');
}

// ── Admin — users ─────────────────────────────────────────────────────────────

export async function getUsers() {
    const r = await authFetch(`${BASE_URL}/admin/users`);
    return (await parseJson(r, 'Failed to fetch users')).users;
}

export async function assignRole(userId, role) {
    const r = await authFetch(`${BASE_URL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
    return (await parseJson(r, 'Failed to assign role')).user;
}

export async function setPermissionOverride(userId, permission, granted) {
    const r = await authFetch(`${BASE_URL}/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission, granted }),
    });
    return (await parseJson(r, 'Failed to set permission override')).user;
}

export async function unlockUser(userId) {
    const r = await authFetch(`${BASE_URL}/admin/users/${userId}/unlock`, { method: 'POST' });
    return parseJson(r, 'Failed to unlock user');
}

export async function getUserTransactions(userId, offset, limit) {
    const params = new URLSearchParams();
    if (offset != null) params.set('offset', offset);
    if (limit != null) params.set('limit', limit);
    const qs = params.toString() ? `?${params}` : '';
    const r = await authFetch(`${BASE_URL}/admin/users/${userId}/transactions${qs}`);
    return parseJson(r, 'Failed to fetch transactions');
}

// ── Admin — impersonation log ─────────────────────────────────────────────────

export async function getImpersonationLog() {
    const r = await authFetch(`${BASE_URL}/admin/impersonation-log`);
    return (await parseJson(r, 'Failed to fetch impersonation log')).log;
}

export async function revokeToken(jti) {
    const r = await authFetch(`${BASE_URL}/admin/tokens/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jti }),
    });
    return parseJson(r, 'Failed to revoke token');
}

// ── Cashflow — categories ─────────────────────────────────────────────────────

export async function getCategories() {
    const r = await authFetch(`${BASE_URL}/categories`);
    return (await parseJson(r, 'Failed to fetch categories')).categories;
}

export async function createCategory(name, color) {
    const r = await authFetch(`${BASE_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
    });
    return (await parseJson(r, 'Failed to create category')).category;
}

export async function updateCategory(id, fields) {
    const r = await authFetch(`${BASE_URL}/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
    });
    return (await parseJson(r, 'Failed to update category')).category;
}

export async function deleteCategory(id) {
    const r = await authFetch(`${BASE_URL}/categories/${id}`, { method: 'DELETE' });
    return parseJson(r, 'Failed to delete category');
}
