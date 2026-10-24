/** Minimal typed client for the LifeSpire Sync API (v1). No dependencies. */

export interface ApiUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
}

export interface SyncSnapshot {
  version: string;
  schemaVersion: number;
  document: unknown;
  updatedAt: string;
}

export interface SyncPushResult {
  version: string;
  updatedAt: string;
}

export class SyncConflictError extends Error {
  readonly currentVersion: string;
  readonly currentUpdatedAt?: string;
  constructor(currentVersion: string, currentUpdatedAt?: string) {
    super(`Sync conflict (server at ${currentVersion})`);
    this.name = 'SyncConflictError';
    this.currentVersion = currentVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
}

async function problemMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { title?: string; code?: string };
    return body.title ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init: RequestInit = {}): Promise<{ res: Response; data: T }> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    const token = options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' });
    if (res.status === 204 || res.status === 304) {
      return { res, data: undefined as T };
    }
    if (!res.ok) {
      if (res.status === 412) {
        const body = (await res.json().catch(() => ({}))) as {
          currentVersion?: string;
          currentUpdatedAt?: string;
        };
        throw new SyncConflictError(body.currentVersion ?? '?', body.currentUpdatedAt);
      }
      throw new Error(await problemMessage(res));
    }
    return { res, data: (await res.json()) as T };
  }

  return {
    async login(email: string, password: string, deviceName: string, totpCode?: string) {
      const { data } = await request<{ accessToken: string; user: ApiUser; totpSetupRequired: boolean }>(
        '/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, deviceName, totpCode }),
        },
      );
      return data;
    },

    async getSync(ifNoneMatch?: string): Promise<SyncSnapshot | null> {
      const headers: Record<string, string> = {};
      if (ifNoneMatch) headers['If-None-Match'] = `"${ifNoneMatch}"`;
      const { res, data } = await request<SyncSnapshot>('/v1/sync', { headers });
      if (res.status === 304) return null;
      return data;
    },

    async putSync(document: unknown, opts: { ifMatch?: string; create?: boolean; idempotencyKey: string }) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey,
      };
      if (opts.create) headers['If-None-Match'] = '*';
      else if (opts.ifMatch) headers['If-Match'] = `"${opts.ifMatch}"`;
      const { data } = await request<SyncPushResult>('/v1/sync', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ document }),
      });
      return data;
    },
  };
}
