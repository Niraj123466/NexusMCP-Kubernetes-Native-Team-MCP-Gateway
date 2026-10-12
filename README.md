# NexusMCP — Team MCP Gateway & WooCommerce Platform

A production-oriented **Team MCP Gateway Platform** running on Kubernetes.  
Host WooCommerce with automated database persistence, aggregate internal and external Model Context Protocol (MCP) servers over Streamable HTTP, manage team access control with cryptographic audit logging, and execute AI agent workflows powered by Google Gemini or local Ollama models.

---

## Architecture Overview

```
                      Browser / External MCP Client
                                     │
                             NGINX Ingress
                     (localhost:9080 / Port 80/443)
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌──────────────────────┐                           ┌───────────────────────┐
│ React 18 Dashboard   │                           │ Gateway API & MCP     │
│ (Vite + TailwindCSS) │ ─── proxy /api & /mcp ──► │ (FastAPI + FastMCP)   │
│ app.nexusmcp.local   │                           │ api.nexusmcp.local    │
└──────────────────────┘                           └───────────┬───────────┘
                                                               │
                         ┌─────────────────────────────────────┼─────────────────────────────────────┐
                         │ (Internal Cluster NetworkPolicies)  │                                     │
                         ▼                                     ▼                                     ▼
             ┌─────────────────────────┐           ┌────────────────────────┐            ┌───────────────────────┐
             │ woocommerce-mcp-svc:8001│           │ time-mcp-svc:8002      │            │ fetch-mcp-svc:8003    │
             │ FastMCP Streamable HTTP │           │ FastMCP Streamable HTTP│            │ FastMCP SSRF Guard    │
             └───────────┬─────────────┘           └────────────────────────┘            └───────────────────────┘
                         │ REST API (X-Forwarded-Proto: https)
                         ▼
             ┌─────────────────────────┐
             │ WordPress + WooCommerce │ (store.nexusmcp.local:9080)
             │ MariaDB 11 StatefulSet  │
             └─────────────────────────┘
```

---

## Key Features

1. **WordPress & WooCommerce on Kubernetes:**
   - Dedicated MariaDB 11 StatefulSet and WordPress 6.7 Deployment with persistent volumes.
   - Bootstrapped WooCommerce with automated sample catalog, store configuration, and internal API keys.
2. **Custom WooCommerce MCP Server (`services/woocommerce-mcp`):**
   - Built on `FastMCP` exposing 5 operational tools (`list_products`, `get_product`, `create_product`, `update_product_stock`, `list_orders`).
   - Transported over MCP Streamable HTTP.
3. **Core Utility MCP Servers:**
   - `services/time-mcp`: stdlib `zoneinfo` time and timezone utility server.
   - `services/fetch-mcp`: SSRF-protected web content and API fetcher blocking loopback, AWS metadata (169.254.169.254), private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), and non-HTTP schemes.
4. **Unified Gateway Aggregator & Proxy (`services/gateway`):**
   - Dynamic discovery and pooling of upstream MCP servers.
   - Automatic namespacing (`<slug>__<tool_name>`).
   - Unified `/mcp` Streamable HTTP endpoint for external agents (Cursor, Claude Desktop, Windsurf).
   - High-entropy API key management (bcrypt-hashed with truncated prefix indexing).
   - Immutable audit logging to PostgreSQL with HMAC-SHA256 argument hashing and latency measurement.
5. **AI Chat Agent (`/api/chat`):**
   - Multi-turn autonomous tool coordination loop.
   - Provider-agnostic adapter architecture:
     - **Google Gemini**: Uses official `google-genai` SDK (`gemini-2.0-flash`).
     - **Ollama**: OpenAI-compatible client for local offline models (`llama3.1`, `qwen2.5`, `mistral`).
6. **Modern React Dashboard (`services/frontend`):**
   - Glassmorphic dark UI built with React 18, Vite, TypeScript, and Tailwind CSS.
   - Interactive AI Chat Agent with execution inspect cards and suggested prompts.
   - Upstream Servers registry with live health status, tool counts, and 1-click sync.
   - Aggregated Tools catalog with JSON schema inspector and live test runner sandbox.
   - Audit logs table with filtering by outcome, latency, and cryptographic hashes.
   - API Key issuance and revocation.

---

## Aggregated MCP Tools Catalog (8 Live Tools)

| Tool Name | Upstream Microservice | Description |
|---|---|---|
| `woocommerce__list_products` | `woocommerce-mcp` | Paginated product search with pricing, inventory & category filtering |
| `woocommerce__get_product` | `woocommerce-mcp` | Full product details including SKU, attributes, and stock count |
| `woocommerce__create_product` | `woocommerce-mcp` | Create new simple products with price and inventory management |
| `woocommerce__update_product_stock`| `woocommerce-mcp` | Modify product inventory quantity and stock status |
| `woocommerce__list_orders` | `woocommerce-mcp` | Query customer orders by status (`processing`, `completed`) |
| `time__get_current_time` | `time-mcp` | Current ISO time with IANA timezone support |
| `time__list_timezones` | `time-mcp` | List canonical available IANA timezones |
| `fetch__fetch_url` | `fetch-mcp` | Safe external HTTP GET with strict SSRF filtering |

---

## Quick Start — Local Development (kind)

### 1. Prerequisites
- Docker 24+
- `kind` 0.20+ (`brew install kind`)
- `kubectl` v1.28+ (`brew install kubectl`)
- `helm` 3+ (`brew install helm`)
- Node.js 20+ (`brew install node`)
- Python 3.12+

### 2. Configure Environment
```bash
cp .env.example .env
# Set LLM_PROVIDER=gemini and GEMINI_API_KEY (or LLM_PROVIDER=ollama)
```

### 3. Bootstrap Cluster & Deploy Platform
```bash
chmod +x scripts/*.sh
./scripts/setup-local.sh
```

### 4. Configure Local DNS
Add the following lines to `/etc/hosts`:
```
127.0.0.1  store.nexusmcp.local:9080
127.0.0.1  api.nexusmcp.local:9080
127.0.0.1  app.nexusmcp.local:9080
```
*(Note: If connecting directly on port 9080, include `Host:` headers or access via `http://localhost:9080`)*

### 5. Service Endpoints
| Service | Local Ingress URL | Port |
|---|---|---|
| **React Dashboard** | `http://app.nexusmcp.local:9080` | 9080 (Ingress) / 3000 (Internal) |
| **Gateway REST API** | `http://api.nexusmcp.local:9080` | 9080 (Ingress) / 8000 (Internal) |
| **Gateway MCP Endpoint** | `http://api.nexusmcp.local:9080/mcp` | 9080 (Streamable HTTP) |
| **Swagger / OpenAPI** | `http://api.nexusmcp.local:9080/docs` | 9080 |
| **WooCommerce Store** | `http://store.nexusmcp.local:9080` | 9080 (Ingress) / 80 (Internal) |

---

## Production VPS Deployment (k3s / Cloud Kubernetes)

NexusMCP uses an umbrella Helm chart (`helm/nexusmcp`) supporting identical resource schemas across environments:

```bash
# Production deployment on k3s or managed cloud Kubernetes
helm upgrade --install nexusmcp ./helm/nexusmcp \
  --namespace nexusmcp \
  --create-namespace \
  -f ./helm/nexusmcp/values-production.yaml \
  --set secrets.geminiApiKey="$GEMINI_API_KEY" \
  --set secrets.postgresPassword="$POSTGRES_PASSWORD" \
  --set secrets.gatewaySecretKey="$GATEWAY_SECRET_KEY"
```

---

## Running the Automated Test Suite

### 1. Unit & Component Tests
```bash
# Gateway unit tests (auth, crypto, aggregator, agent adapters)
cd services/gateway && pytest -v

# WooCommerce MCP server tests
cd services/woocommerce-mcp && pytest -v

# Time MCP server tests
cd services/time-mcp && pytest -v

# Fetch MCP server & SSRF guard tests
cd services/fetch-mcp && pytest -v
```

### 2. Live Kubernetes End-to-End Acceptance Tests (19 Tests)
```bash
# Runs full integration suite against the live in-cluster services
services/gateway/.venv/bin/pytest tests/e2e/test_platform_e2e.py -v
```

Tests verify:
- Ingress reachability and health checks across Gateway & Frontend
- X-API-Key and Authorization Bearer authentication
- Upstream server registration & synchronization
- Namespaced tool discovery across all 3 microservices
- Direct tool execution (WooCommerce create/get/list, Time, Fetch)
- Strict SSRF protection against 127.0.0.1, AWS metadata, and Kubernetes cluster IPs
- Cryptographic HMAC-SHA256 argument audit logging to PostgreSQL
- Multi-turn AI Chat agent execution
- MCP Streamable HTTP JSON-RPC handshake (`mcp-session-id`)

---

## Connecting External MCP Clients

External IDEs and AI tools (such as Cursor, Windsurf, or Claude Desktop) connect to all tools through one unified endpoint:

```json
{
  "mcpServers": {
    "nexusmcp": {
      "url": "http://api.nexusmcp.local:9080/mcp",
      "headers": {
        "X-API-Key": "nexus_CAuAv_SsN5eLFAEDdqIy5N7XNFJB5MRodK9pJ_bypzY"
      }
    }
  }
}
```

---

## License
MIT
