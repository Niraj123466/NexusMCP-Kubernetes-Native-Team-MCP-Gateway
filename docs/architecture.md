# Architecture

## Overview

NexusMCP is a **Team MCP Gateway Platform** that runs entirely on Kubernetes. It layers four main concerns:

1. **E-commerce store** — WordPress + WooCommerce backed by MariaDB.
2. **MCP upstream servers** — three specialised FastMCP servers (WooCommerce tools, time tools, fetch tools) reachable only from inside the cluster.
3. **Gateway** — a single FastAPI + FastMCP service that authenticates callers, aggregates tools from all upstreams, and exposes one `/mcp` endpoint to the outside world.
4. **Dashboard** — a React + TypeScript single-page application for platform management and AI-powered chat.

---

## Component Map

| Component | Technology | Kubernetes workload | Ingress |
|---|---|---|---|
| WordPress / WooCommerce | PHP-FPM + nginx sidecar | Deployment | Public (store domain) |
| MariaDB | MariaDB 11 | StatefulSet | None (ClusterIP) |
| WooCommerce MCP Server | Python 3.12, FastMCP | Deployment | None (ClusterIP) |
| Time MCP Server | Python 3.12, FastMCP | Deployment | None (ClusterIP) |
| Fetch MCP Server | Python 3.12, FastMCP | Deployment | None (ClusterIP) |
| Gateway Backend | Python 3.12, FastAPI + FastMCP | Deployment | `/api/*`, `/mcp` |
| Platform DB | PostgreSQL 16 | StatefulSet | None (ClusterIP) |
| Dashboard | React (nginx container) | Deployment | `/app/*` |
| NGINX Ingress Controller | NGINX | DaemonSet / Deployment | NodePort 80/443 |

---

## Request Flows

### External MCP Client

```
External Client  →  NGINX Ingress (/mcp)
  →  Gateway Backend
       validate X-API-Key → resolve User + Roles
       list aggregated tools (from cache)
       receive tool_call request
       validate permissions
       execute tool on correct upstream (WooCommerce / Time / Fetch)
       write AuditLog (user, tool, upstream, args_hash, duration, outcome)
       return result
```

### AI Chat Agent (Dashboard)

```
User sends message in Dashboard
  →  POST /api/chat  (session cookie → user identity)
  →  Gateway Chat Loop
       1. discover tools via internal aggregator
       2. call Gemini (gemini-2.0-flash) or Ollama with message + tool definitions
       3. receive tool_use block from LLM
       4. validate tool + arguments
       5. execute as logged-in user through aggregator
       6. return result to LLM
       7. repeat until final answer or limit (10 iterations)
       8. stream chunks back to Dashboard
       audit log entry per tool call, attributed to the authenticated user
```

### Admin Registering an Upstream

```
Admin POSTs /api/upstreams  (admin API key required)
  →  Gateway validates SSRF guard on provided URL
       block: loopback, RFC1918, link-local, cloud metadata IPs
       allow: hostnames in SSRF_INTERNAL_ALLOWLIST
  →  resolve DNS, re-validate resolved IP
  →  persist UpstreamServer record (encrypted bearer token if provided)
  →  aggregator picks up new upstream on next refresh cycle
```

---

## LLM Adapter Design

The `agent/llm_client.py` module exposes a single `LLMClient` abstract class:

```python
class LLMClient(Protocol):
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
    ) -> LLMResponse: ...
```

Two concrete adapters:
- **`GeminiAdapter`** — uses `google-genai` SDK, maps MCP tool schemas to Gemini function declarations.
- **`OllamaAdapter`** — uses `openai` Python library pointed at `OLLAMA_BASE_URL/v1`, maps MCP tool schemas to OpenAI function call format (which Ollama's compatibility layer understands).

`LLM_PROVIDER` env var selects the adapter at startup. Swapping providers requires no application code changes.

---

## Tool Namespacing

When multiple upstreams expose a tool with the same name, the gateway prefixes all tools with a deterministic upstream slug:

```
woocommerce__list_products
time__get_current_time
fetch__fetch_url
```

The slug is derived from the upstream's registered `slug` field (lowercased, non-alphanumeric replaced with `_`). External MCP clients always see the namespaced name.

---

## Security Architecture

See [security.md](security.md) for the full threat model. Key points:

- **API keys** are `secrets.token_urlsafe(32)` → `bcrypt`-hashed before storage. The plaintext key is shown to the user exactly once.
- **Roles**: `admin` (full management) and `member` (tool execution only).
- **Upstream credentials** (bearer tokens, headers) are stored encrypted in PostgreSQL and never sent to browsers or MCP clients.
- **SSRF guard** (`mcp/ssrf_guard.py`) validates every upstream URL at registration time and re-validates after DNS resolution.
- **Audit logs** record every tool call: user ID, upstream, tool name, argument hash, duration, outcome. Secrets are never logged.

---

## Data Model (PostgreSQL)

```
users            id, username, email, role, created_at
api_keys         id, user_id, key_hash, prefix, name, last_used_at, revoked_at
upstream_servers id, slug, name, url, auth_type, auth_value_enc, enabled, created_by
audit_logs       id, user_id, upstream_id, tool_name, args_hash, duration_ms, outcome, error, created_at
tool_permissions id, user_id, upstream_id, tool_name, allowed  (optional fine-grained)
```

---

## Networking

All upstream MCP servers run as ClusterIP Services with no Ingress. NetworkPolicies enforce:

- Only the gateway pod may reach `woocommerce-mcp-svc:8001`, `time-mcp-svc:8002`, `fetch-mcp-svc:8003`.
- Only the gateway pod may reach `postgres-svc:5432`.
- WordPress may reach `mariadb-svc:3306`.
- Only the WooCommerce MCP server may reach WordPress (for REST API calls).

---

## Persistence

| Data | Storage | PVC size (local) |
|---|---|---|
| WordPress uploads | ReadWriteOnce PVC | 5 Gi |
| MariaDB data | ReadWriteOnce PVC | 10 Gi |
| PostgreSQL data | ReadWriteOnce PVC | 5 Gi |
