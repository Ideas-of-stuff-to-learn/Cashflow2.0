import * as SecureStore from 'expo-secure-store';

const BASE_URL = "https://cashflowbackend-1era.onrender.com";

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
    if (!response.ok) throw new Error(data.error || fallbackMessage);
    return data;
}

export async function getCategories() {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/categories`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await parseJsonResponse(response, 'Failed to fetch categories');
    return data.categories;
}
export async function updateCategory(categoryName, { newName, color } = {}) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');
 
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
    const response = await fetch(`${BASE_URL}/categories`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
 
    return await parseJsonResponse(response, 'Failed to update category');
}
export async function getTransactionHistory() {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/transactions`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    const data = await parseJsonResponse(response, 'Failed to fetch transaction history');
    return data.transactions;
}
export async function signup(username, password) {
    const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse(response, 'Signup failed');
    await SecureStore.setItemAsync('jwt_token', data.access_token);
    return data.access_token;
}
export async function login(username, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse(response, 'Login failed');
    await SecureStore.setItemAsync('jwt_token', data.access_token);
    return data.access_token;
}

export async function getToken() {
    return await SecureStore.getItemAsync('jwt_token');
}

export async function logout() {
    await SecureStore.deleteItemAsync('jwt_token');
}

export async function categorizeCached(transactions) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/categorize/cached`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactions }),
    });

    const data = await parseJsonResponse(response, 'Cache lookup failed');
    return data.transactions;
}

export async function categorizeLLM(transactions) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/categorize/llm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactions }),
    });

    const data = await parseJsonResponse(response, 'LLM categorisation failed');
    return data.transactions;
}
export async function parseCSVFiles(files) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', {
            uri: file.uri,
            name: file.name,
            type: 'text/csv',
        });
    }

    const response = await fetch(`${BASE_URL}/api/parse-csv`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            // DO NOT set Content-Type manually here - React Native sets it
            // automatically with the correct multipart boundary when
            // you pass FormData. Setting it manually breaks it.
        },
        body: formData,
    });

    const data = await parseJsonResponse(response, 'Failed to parse CSV');
    return data.transactions;
}

export async function categorizeTransactions(transactions) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/categorize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactions }),
    });

    const data = await parseJsonResponse(response, 'Categorization failed');
    return data.transactions;
}

export async function resolveCategories(resolutions) {
    const token = await getToken();
    if (!token) throw new Error('Not logged in');

    const response = await fetch(`${BASE_URL}/categorize/resolve`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
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
    const token = await getToken();
    if (!token) throw new Error('Not logged in');
 
    const response = await fetch(`${BASE_URL}/charts/summary`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
 
    return await parseJsonResponse(response, 'Failed to fetch chart summary');
}