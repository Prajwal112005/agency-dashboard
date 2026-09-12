import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// The access token lives only in memory (a module-level variable), never in
// localStorage or a readable cookie — that's the whole point of pairing it
// with an HttpOnly refresh cookie. It's lost on hard refresh, which is why
// AuthContext calls /auth/refresh once on app boot to re-establish it from
// the refresh cookie.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // sends the HttpOnly refresh cookie
});

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_BASE}/api/auth/refresh`,
      {},
      { withCredentials: true }
    );
    setAccessToken(res.data.accessToken);
    return res.data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

// On a 401 (expired access token), transparently refresh once and retry the
// original request. Concurrent 401s share a single in-flight refresh call.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => (refreshPromise = null));
      const token = await refreshPromise;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export { refreshAccessToken };
