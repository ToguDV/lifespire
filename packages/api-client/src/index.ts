/** Typed client for the LifeSpire Sync API (v1). No dependencies. */

export interface ApiUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
}

export interface MeResponse extends ApiUser {
  totpEnabled: boolean;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  user: ApiUser;
  totpSetupRequired: boolean;
  /** Present only for native clients, which store it in the OS keychain. */
  refreshToken?: string;
}

export interface TotpSetupResult {
  otpauthUrl: string;
  manualSecret: string;
  recoveryCodes: string[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  deviceCount: number;
  lastLoginAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface AdminUsersResponse {
  total: number;
  page: number;
  pageSize: number;
  users: AdminUser[];
}

export interface CreateUserResponse {
  id: string;
  email: string;
  inviteLink: string;
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

export interface SyncRevision {
  version: string;
  schemaVersion: number;
  checksum: string;
  deviceId: string | null;
  createdAt: string;
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

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, title: string, code?: string) {
    super(title);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  setAccessToken?: (token: string | null) => void;
  /**
   * Cookie mode keeps the HttpOnly refresh cookie used by the web. Native mode
   * receives the refresh token in the login/accept/refresh body, sends it via
   * the native-client header gate and stores it in the OS keychain.
   */
  mode?: 'cookie' | 'native';
  platform?: 'android' | 'ios';
  getRefreshToken?: () => string | null;
  setRefreshToken?: (token: string | null) => void;
  /**
   * Transport override. The desktop shell routes requests through its main
   * process so the refresh token never reaches renderer JavaScript; every other
   * client keeps the global fetch.
   */
  fetchFn?: typeof fetch;
}

/** Wraps a version in ETag quotes unless already quoted (`"n"` / `W/"n"`). */
function asQuoted(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith('W/"')) return value;
  return `"${value}"`;
}

interface ProblemBody {
  title?: string;
  code?: string;
}

async function readProblem(res: Response): Promise<ProblemBody> {
  try {
    return (await res.json()) as ProblemBody;
  } catch {
    return {};
  }
}

function isAuthPath(path: string): boolean {
  return (
    path === '/v1/auth/login' ||
    path === '/v1/auth/refresh' ||
    path === '/v1/auth/accept-invite' ||
    path === '/v1/auth/reset-password'
  );
}

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');
  const native = options.mode === 'native';
  const fetchFn = options.fetchFn ?? fetch;

  function nativeHeaders(): Record<string, string> {
    if (!native) return {};
    return { 'X-Client-Platform': options.platform ?? 'android' };
  }

  function rememberAuth(out: { accessToken: string; refreshToken?: string }): void {
    options.setAccessToken?.(out.accessToken);
    if (out.refreshToken) options.setRefreshToken?.(out.refreshToken);
  }

  async function rawRequest<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<{ res: Response; data: T }> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    const token = options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchFn(`${base}${path}`, { ...init, headers, credentials: 'include' });
    if (res.status === 204 || res.status === 304) {
      return { res, data: undefined as T };
    }
    if (!res.ok) {
      const body = await readProblem(res);
      if (res.status === 412) {
        const raw = body as ProblemBody & { currentVersion?: string; currentUpdatedAt?: string };
        throw new SyncConflictError(raw.currentVersion ?? '?', raw.currentUpdatedAt);
      }
      throw new ApiRequestError(res.status, body.title ?? `HTTP ${res.status}`, body.code);
    }
    return { res, data: (await res.json()) as T };
  }

  let refreshInFlight: Promise<{ accessToken: string; refreshToken?: string }> | null = null;

  async function performRefresh(): Promise<{ accessToken: string; refreshToken?: string }> {
    const refreshToken = options.getRefreshToken?.() ?? null;
    if (native && !refreshToken) {
      throw new ApiRequestError(401, 'Missing refresh token', 'AUTH_TOKEN_EXPIRED');
    }
    const { data } = await rawRequest<{ accessToken: string; refreshToken?: string }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        headers: {
          ...nativeHeaders(),
          ...(native ? { 'Content-Type': 'application/json' } : {}),
        },
        body: native ? JSON.stringify({ refreshToken }) : undefined,
      },
    );
    rememberAuth(data);
    return data;
  }

  /**
   * Single-flight rotation: concurrent 401s share one refresh promise. Two
   * rotations would present the same token twice and the server would revoke
   * the whole family as reuse.
   */
  function refreshTokens(): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!refreshInFlight) {
      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<{ res: Response; data: T }> {
    try {
      return await rawRequest<T>(path, init);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 401 &&
        !isAuthPath(path) &&
        options.setAccessToken
      ) {
        try {
          await refreshTokens();
          return await rawRequest<T>(path, init);
        } catch {
          throw error;
        }
      }
      throw error;
    }
  }

  async function postNoContent(path: string, body?: unknown): Promise<void> {
    await request<unknown>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  }

  return {
    async login(email: string, password: string, deviceName: string, totpCode?: string) {
      const { data } = await request<LoginResult>('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...nativeHeaders() },
        body: JSON.stringify({ email, password, deviceName, totpCode }),
      });
      rememberAuth(data);
      return data;
    },

    async acceptInvite(token: string, password: string, deviceName: string) {
      const { data } = await request<{ accessToken: string; refreshToken?: string }>(
        '/v1/auth/accept-invite',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...nativeHeaders() },
          body: JSON.stringify({ token, password, deviceName }),
        },
      );
      rememberAuth(data);
      return data;
    },

    async refresh() {
      return refreshTokens();
    },

    async logout() {
      try {
        await request<unknown>('/v1/auth/logout', { method: 'POST' });
      } finally {
        options.setAccessToken?.(null);
        options.setRefreshToken?.(null);
      }
    },

    async logoutAll() {
      try {
        await request<unknown>('/v1/auth/logout-all', { method: 'POST' });
      } finally {
        options.setAccessToken?.(null);
        options.setRefreshToken?.(null);
      }
    },

    async me(): Promise<MeResponse> {
      const { data } = await request<MeResponse>('/v1/me');
      return data;
    },

    async changePassword(currentPassword: string, newPassword: string) {
      await postNoContent('/v1/auth/change-password', { currentPassword, newPassword });
    },

    async resetPassword(token: string, password: string) {
      await postNoContent('/v1/auth/reset-password', { token, password });
    },

    async totpSetup(currentPassword: string): Promise<TotpSetupResult> {
      const { data } = await request<TotpSetupResult>('/v1/auth/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword }),
      });
      return data;
    },

    async totpEnable(code: string) {
      await postNoContent('/v1/auth/totp/enable', { code });
    },

    async getSync(ifNoneMatch?: string): Promise<SyncSnapshot | null> {
      const headers: Record<string, string> = {};
      if (ifNoneMatch) headers['If-None-Match'] = asQuoted(ifNoneMatch);
      try {
        const { res, data } = await request<SyncSnapshot>('/v1/sync', { headers });
        if (res.status === 304) return null;
        return data;
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },

    async putSync(document: unknown, opts: { ifMatch?: string; create?: boolean; idempotencyKey: string }) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey,
      };
      if (opts.create) headers['If-None-Match'] = '*';
      else if (opts.ifMatch) headers['If-Match'] = asQuoted(opts.ifMatch);
      const { data } = await request<SyncPushResult>('/v1/sync', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ document }),
      });
      return data;
    },

    async getRevisions(limit = 20): Promise<{ revisions: SyncRevision[] }> {
      const { data } = await request<{ revisions: SyncRevision[] }>(
        `/v1/sync/revisions?limit=${Math.min(Math.max(limit, 1), 50)}`,
      );
      return data;
    },

    async listUsers(): Promise<AdminUsersResponse> {
      const { data } = await request<AdminUsersResponse>('/v1/admin/users?pageSize=100');
      return data;
    },

    async createUser(email: string, role: 'ADMIN' | 'USER'): Promise<CreateUserResponse> {
      const { data } = await request<CreateUserResponse>('/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      return data;
    },

    async deleteSync(): Promise<void> {
      await request<unknown>('/v1/sync', { method: 'DELETE' });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
