import {
  UpstreamServer,
  ToolDefinition,
  AuditLog,
  UserProfile,
  ApiKeyItem,
} from "../types";

const STORAGE_KEY_API_KEY = "nexusmcp_api_key";
const STORAGE_KEY_BASE_URL = "nexusmcp_base_url";

export function getStoredApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_API_KEY) || "";
}

export function setStoredApiKey(key: string): void {
  if (key) {
    localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
  }
}

export function getStoredBaseUrl(): string {
  const custom = localStorage.getItem(STORAGE_KEY_BASE_URL);
  if (custom) return custom;
  // If loaded in browser at app.nexusmcp.local:9080 -> api.nexusmcp.local:9080
  if (typeof window !== "undefined" && window.location.hostname.includes("nexusmcp.local")) {
    const port = window.location.port ? `:${window.location.port}` : "";
    return `${window.location.protocol}//api.nexusmcp.local${port}`;
  }
  return "";
}

export function setStoredBaseUrl(url: string): void {
  if (url) {
    localStorage.setItem(STORAGE_KEY_BASE_URL, url.trim().replace(/\/+$/, ""));
  } else {
    localStorage.removeItem(STORAGE_KEY_BASE_URL);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getStoredBaseUrl();
  const apiKey = getStoredApiKey();

  const url = baseUrl ? `${baseUrl}${path}` : path;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
    headers.set("X-API-Key", apiKey);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(errorDetail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health
  checkHealth: async (): Promise<{ status: string; version: string }> => {
    return request<{ status: string; version: string }>("/health");
  },

  // Auth / Users
  getCurrentUser: async (): Promise<UserProfile> => {
    return request<UserProfile>("/api/users/me");
  },

  listUsers: async (): Promise<UserProfile[]> => {
    return request<UserProfile[]>("/api/users");
  },

  // API Keys
  listKeys: async (): Promise<ApiKeyItem[]> => {
    return request<ApiKeyItem[]>("/api/keys");
  },

  createKey: async (name: string, userId?: string): Promise<{ id: string; name: string; key: string; prefix: string }> => {
    return request<{ id: string; name: string; key: string; prefix: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name, user_id: userId || null }),
    });
  },

  revokeKey: async (keyId: string): Promise<void> => {
    await request<void>(`/api/keys/${keyId}`, {
      method: "DELETE",
    });
  },

  // Upstream MCP Servers
  listUpstreams: async (): Promise<UpstreamServer[]> => {
    return request<UpstreamServer[]>("/api/upstreams");
  },

  createUpstream: async (data: {
    slug: string;
    name: string;
    url: string;
    description?: string;
    auth_type?: string;
    auth_token?: string;
    auth_header_name?: string;
    timeout_seconds?: number;
  }): Promise<UpstreamServer> => {
    return request<UpstreamServer>("/api/upstreams", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteUpstream: async (slug: string): Promise<void> => {
    await request<void>(`/api/upstreams/${slug}`, {
      method: "DELETE",
    });
  },

  syncUpstream: async (slug: string): Promise<any> => {
    return request<any>(`/api/upstreams/${slug}/sync`, {
      method: "POST",
    });
  },

  updateUpstream: async (
    slug: string,
    data: { name?: string; url?: string; description?: string; enabled?: boolean }
  ): Promise<UpstreamServer> => {
    return request<UpstreamServer>(`/api/upstreams/${slug}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Tools
  listTools: async (): Promise<ToolDefinition[]> => {
    return request<ToolDefinition[]>("/api/tools");
  },

  executeTool: async (name: string, args: Record<string, unknown>): Promise<any> => {
    return request<any>("/api/tools/execute", {
      method: "POST",
      body: JSON.stringify({ name, arguments: args }),
    });
  },

  // Audit Logs
  listAuditLogs: async (params?: { outcome?: string; limit?: number; offset?: number }): Promise<AuditLog[]> => {
    const q = new URLSearchParams();
    if (params?.outcome) q.set("outcome", params.outcome);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request<AuditLog[]>(`/api/audit${qs}`);
  },

  // AI Chat Agent
  chat: async (
    messages: { role: string; content?: string; tool_calls?: any; tool_call_id?: string; name?: string }[],
    systemPrompt?: string
  ): Promise<{
    message: { role: string; content: string; tool_calls?: any };
    tool_executions: any[];
    iterations: number;
    messages: any[];
  }> => {
    return request("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages,
        system_prompt: systemPrompt || undefined,
      }),
    });
  },
};
