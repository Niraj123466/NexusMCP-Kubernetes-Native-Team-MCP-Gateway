export interface UpstreamServer {
  id: string;
  slug: string;
  name: string;
  url: string;
  transport: string;
  is_enabled: boolean;
  status: "HEALTHY" | "UNHEALTHY" | "SYNCING" | "UNKNOWN";
  last_synced_at: string | null;
  tool_count: number;
  description?: string;
  created_at: string;
}

export interface ToolDefinition {
  name: string;
  upstream_slug: string;
  description: string;
  input_schema: {
    type?: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      default?: unknown;
      enum?: unknown[];
    }>;
    required?: string[];
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  tool_name: string;
  user_id: string;
  user_email?: string;
  user_role?: string;
  input_hash?: string;
  input_preview?: Record<string, unknown>;
  output_summary?: string;
  status: "success" | "error";
  error_message?: string;
  duration_ms: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: {
    id?: string;
    tool: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    status: "executing" | "success" | "error";
  }[];
  duration_ms?: number;
  model?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: "admin" | "member" | "viewer";
  is_active: boolean;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}
