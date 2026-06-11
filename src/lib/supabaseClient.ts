type SupabaseUser = {
  id: string;
  email?: string;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: SupabaseUser;
};

type AuthStateChangeCallback = (session: SupabaseSession | null) => void;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

function requireSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  }
}

const SESSION_STORAGE_KEY = "ee_supabase_session";
const SESSION_META_KEY = "ee_supabase_session_meta";
const DEFAULT_SESSION_TTL_SECONDS = (() => {
  const v = Number.parseInt((import.meta.env.VITE_ADMIN_SESSION_TTL_SECONDS as string | undefined) || "", 10);
  return Number.isFinite(v) && v > 0 ? v : 3600;
})();
const authListeners = new Set<AuthStateChangeCallback>();

type SessionMeta = { last_active_at: number; ttl_seconds: number };

function loadMeta(): SessionMeta | null {
  const raw = localStorage.getItem(SESSION_META_KEY);
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<SessionMeta>;
    if (typeof m.last_active_at !== "number") return null;
    const ttl = typeof m.ttl_seconds === "number" && m.ttl_seconds > 0 ? m.ttl_seconds : DEFAULT_SESSION_TTL_SECONDS;
    return { last_active_at: m.last_active_at, ttl_seconds: ttl };
  } catch {
    return null;
  }
}

function saveMeta(meta: SessionMeta | null) {
  if (!meta) localStorage.removeItem(SESSION_META_KEY);
  else localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
}

function touchMeta(ttlSeconds?: number) {
  const now = Math.floor(Date.now() / 1000);
  const prev = loadMeta();
  saveMeta({ last_active_at: now, ttl_seconds: ttlSeconds ?? prev?.ttl_seconds ?? DEFAULT_SESSION_TTL_SECONDS });
}

export function setAdminSessionTtlSeconds(ttlSeconds: number) {
  const v = Math.max(60, Math.floor(ttlSeconds));
  const now = Math.floor(Date.now() / 1000);
  const prev = loadMeta();
  saveMeta({ last_active_at: prev?.last_active_at ?? now, ttl_seconds: v });
}

function isIdleExpired() {
  const meta = loadMeta();
  if (!meta) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - meta.last_active_at > meta.ttl_seconds;
}

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getJwtExp(accessToken: string): number | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1] ?? "")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function loadSession(): SupabaseSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    return null;
  }
}

function saveSession(session: SupabaseSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    saveMeta(null);
  } else {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    touchMeta();
  }
  for (const cb of authListeners) cb(session);
}

async function authRequest<T>(path: string, body: unknown): Promise<T> {
  requireSupabase();
  const res = await fetch(`${supabaseUrl}${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg =
      (json as { error_description?: string; msg?: string })?.error_description ||
      (json as { msg?: string })?.msg ||
      `Auth request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

async function refreshSession(refreshToken: string): Promise<SupabaseSession> {
  const json = await authRequest<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: SupabaseUser;
  }>("/auth/v1/token?grant_type=refresh_token", { refresh_token: refreshToken });

  const exp = getJwtExp(json.access_token);
  const expiresAt = exp ?? Math.floor(Date.now() / 1000) + json.expires_in;

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
    expires_at: expiresAt,
    user: json.user,
  };
}

async function getValidSession(): Promise<SupabaseSession | null> {
  const session = loadSession();
  if (!session) return null;
  if (isIdleExpired()) {
    saveSession(null);
    return null;
  }
  touchMeta();
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at > now + 60) return session;
  try {
    const refreshed = await refreshSession(session.refresh_token);
    saveSession(refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  requireSupabase();
  const session = await getValidSession();
  const headers = new Headers(init?.headers);
  headers.set("apikey", supabaseAnonKey);
  headers.set("Accept", "application/json");
  if (session) headers.set("Authorization", `Bearer ${session.access_token}`);

  const res = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 204) return null as T;

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string })?.message || (json as { error?: string })?.error;
    const suffix = `HTTP ${res.status} ${path}`;
    throw new Error(msg ? `${msg} (${suffix})` : `API request failed (${suffix})`);
  }
  return json as T;
}

function toPublicObjectUrl(bucket: string, path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export const supabase = {
  auth: {
    async signInWithPassword(input: { email: string; password: string }) {
      const json = await authRequest<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: SupabaseUser;
      }>("/auth/v1/token?grant_type=password", {
        email: input.email,
        password: input.password,
      });

      const exp = getJwtExp(json.access_token);
      const expiresAt = exp ?? Math.floor(Date.now() / 1000) + json.expires_in;
      const session: SupabaseSession = {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_in: json.expires_in,
        expires_at: expiresAt,
        user: json.user,
      };

      saveSession(session);
      return { data: { session }, error: null } as const;
    },
    async signUp(input: { email: string; password: string }) {
      const json = await authRequest<{
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user: SupabaseUser;
      }>("/auth/v1/signup", {
        email: input.email,
        password: input.password,
      });

      if (json.access_token && json.refresh_token && json.expires_in) {
        const exp = getJwtExp(json.access_token);
        const expiresAt = exp ?? Math.floor(Date.now() / 1000) + json.expires_in;
        const session: SupabaseSession = {
          access_token: json.access_token,
          refresh_token: json.refresh_token,
          expires_in: json.expires_in,
          expires_at: expiresAt,
          user: json.user,
        };
        saveSession(session);
        return { data: { user: json.user, session }, error: null } as const;
      }

      return { data: { user: json.user, session: null }, error: null } as const;
    },
    async signOut() {
      saveSession(null);
      return { error: null } as const;
    },
    async getSession() {
      const session = await getValidSession();
      return { data: { session }, error: null } as const;
    },
    onAuthStateChange(callback: AuthStateChangeCallback) {
      authListeners.add(callback);
      callback(loadSession());
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      } as const;
    },
  },
  functions: {
    async invoke<T>(name: string, body: unknown) {
      const data = await apiFetch<T>(`/functions/v1/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { data, error: null } as const;
    },
  },
  async rpc<T>(fn: string, args?: Record<string, unknown>) {
    const body = args ? JSON.stringify(args) : "{}";
    const data = await apiFetch<T>(`/rest/v1/rpc/${encodeURIComponent(fn)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    return { data, error: null } as const;
  },
  async rest<T>(table: string, query: string, init?: RequestInit) {
    const data = await apiFetch<T>(`/rest/v1/${encodeURIComponent(table)}${query}`, init);
    return { data, error: null } as const;
  },
  storage: {
    async uploadPublic(bucket: string, path: string, file: File) {
      const session = await getValidSession();
      if (!session) throw new Error("Not signed in");

      const cleanPath = path
        .split("/")
        .map((p) => (p === "" ? p : safeFileName(p)))
        .join("/");

      await apiFetch<void>(`/storage/v1/object/${encodeURIComponent(bucket)}/${cleanPath}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: file,
      });

      return { publicUrl: toPublicObjectUrl(bucket, cleanPath), path: cleanPath };
    },
    async list(bucket: string, path?: string) {
      const prefix = (path ?? "").trim().replace(/^\/+|\/+$/g, "");
      const data = await apiFetch<{ name: string; id: string; created_at: string; metadata: any }[]>(
        `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prefix: prefix ? `${prefix}/` : "",
            limit: 100,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          }),
        }
      );
      return { data, error: null } as const;
    },
    async remove(bucket: string, paths: string[]) {
      await apiFetch<void>(`/storage/v1/object/${encodeURIComponent(bucket)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
      return { error: null } as const;
    },
  },
};

export async function bootstrapFirstAdmin(userId: string) {
  const { data } = await supabase.rest<{ user_id: string }[]>(
    "admins",
    "",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ user_id: userId }]),
    }
  );
  return data;
}


