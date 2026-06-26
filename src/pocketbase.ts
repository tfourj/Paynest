import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";

export type PocketBaseConnectionSettings = {
  url: string;
};

export type PocketBaseResolvedConfig = {
  url: string;
  isConfigured: boolean;
  sessionStorageKey: string;
};

export type PocketBaseUser = {
  id: string;
  email?: string;
  verified?: boolean;
};

export type PocketBaseSession = {
  token: string;
  user: PocketBaseUser;
};

type PocketBaseAuthResponse = {
  token: string;
  record: PocketBaseUser;
};

type PocketBaseListResponse<T> = {
  items: T[];
};

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

const sessionRefreshes = new Map<string, Promise<PocketBaseSession | null>>();
const minimumPasswordLength = 8;

export const defaultPocketBaseConnection: PocketBaseConnectionSettings = {
  url: process.env.EXPO_PUBLIC_POCKETBASE_URL?.trim() ?? "",
};

export function resolvePocketBaseConfig(settings: PocketBaseConnectionSettings): PocketBaseResolvedConfig {
  const url = normalizeUrl(settings.url);

  return {
    url,
    isConfigured: url.length > 0,
    sessionStorageKey: `paynest.pocketbaseSession.${storageKeySegment(url)}`,
  };
}

export function createPocketBaseClient(config: PocketBaseResolvedConfig) {
  if (!config.isConfigured) return null;
  return new PocketBaseClient(config);
}

export class PocketBaseClient {
  constructor(private readonly config: PocketBaseResolvedConfig) {}

  async loadSession() {
    const storedSession = await AsyncStorage.getItem(this.config.sessionStorageKey);
    if (!storedSession) return null;

    try {
      const session = JSON.parse(storedSession) as PocketBaseSession;
      if (!session.token || !session.user?.id) return null;
      return await this.refreshSessionOnce(session.token);
    } catch {
      await this.clearSession();
      return null;
    }
  }

  async signIn(email: string, password: string) {
    const auth = await this.request<PocketBaseAuthResponse>("/api/collections/users/auth-with-password", {
      method: "POST",
      body: { identity: email, password },
    });
    return this.saveAuth(auth);
  }

  async signUp(email: string, password: string) {
    if (password.length < minimumPasswordLength) {
      throw new Error(`Enter a password with at least ${minimumPasswordLength} characters.`);
    }

    await this.request("/api/collections/users/records", {
      method: "POST",
      body: {
        email,
        password,
        passwordConfirm: password,
        emailVisibility: true,
      },
    });
    await this.requestVerification(email);
  }

  async requestVerification(email: string) {
    await this.request("/api/collections/users/request-verification", {
      method: "POST",
      body: { email },
    });
  }

  async requestPasswordReset(email: string) {
    await this.request("/api/collections/users/request-password-reset", {
      method: "POST",
      body: { email },
    });
  }

  async signOut() {
    await this.clearSession();
  }

  async listRecords<T>(collection: string, token: string, query?: Record<string, string | number | boolean>) {
    const queryString = query ? `?${new URLSearchParams(queryStringValues(query)).toString()}` : "";
    const result = await this.request<PocketBaseListResponse<T>>(
      `/api/collections/${collection}/records${queryString}`,
      { token },
    );
    return result.items;
  }

  async createRecord<T>(collection: string, token: string, body: unknown) {
    return this.request<T>(`/api/collections/${collection}/records`, {
      method: "POST",
      token,
      body,
    });
  }

  async updateRecord<T>(collection: string, recordId: string, token: string, body: unknown) {
    return this.request<T>(`/api/collections/${collection}/records/${recordId}`, {
      method: "PATCH",
      token,
      body,
    });
  }

  async deleteRecord(collection: string, recordId: string, token: string) {
    await this.request(`/api/collections/${collection}/records/${recordId}`, {
      method: "DELETE",
      token,
    });
  }

  private async refreshSessionOnce(token: string) {
    const refreshKey = `${this.config.sessionStorageKey}:${token}`;
    const currentRefresh = sessionRefreshes.get(refreshKey);
    if (currentRefresh) return currentRefresh;

    const refresh = this.refreshSession(token).finally(() => {
      sessionRefreshes.delete(refreshKey);
    });
    sessionRefreshes.set(refreshKey, refresh);
    return refresh;
  }

  private async refreshSession(token: string) {
    try {
      const auth = await this.request<PocketBaseAuthResponse>("/api/collections/users/auth-refresh", {
        method: "POST",
        token,
      });
      return this.saveAuth(auth);
    } catch {
      await this.clearSession();
      return null;
    }
  }

  private async saveAuth(auth: PocketBaseAuthResponse) {
    const session = {
      token: auth.token,
      user: auth.record,
    };
    await AsyncStorage.setItem(this.config.sessionStorageKey, JSON.stringify(session));
    return session;
  }

  private async clearSession() {
    await AsyncStorage.removeItem(this.config.sessionStorageKey);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = options.token;

    const response = await fetch(`${this.config.url}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 204) return null as T;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(pocketBaseErrorMessage(data) ?? "PocketBase request failed");
    }

    return data as T;
  }
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function storageKeySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "default";
}

function queryStringValues(values: Record<string, string | number | boolean>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `${value}`]),
  );
}

function pocketBaseErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const fieldErrors = pocketBaseFieldErrors(data);
  if (fieldErrors.length > 0) return fieldErrors.join(" ");
  if ("message" in data && typeof data.message === "string") return data.message;
  return null;
}

function pocketBaseFieldErrors(data: object) {
  if (!("data" in data) || !data.data || typeof data.data !== "object") return [];

  return Object.entries(data.data).flatMap(([field, value]) => {
    if (!value || typeof value !== "object") return [];
    if ("message" in value && typeof value.message === "string") {
      return [`${field}: ${value.message}`];
    }
    if ("code" in value && typeof value.code === "string") {
      return [`${field}: ${value.code}`];
    }
    return [];
  });
}
