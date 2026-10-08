# NexusMCP

A production-oriented **Team MCP Gateway Platform** built on Kubernetes.  
Run WooCommerce, manage MCP upstream servers, and let your team interact with them through a unified gateway and AI chat interface.

---

## Architecture at a Glance

```
Browser / External MCP Client
        │
   NGINX Ingress
        │
   ┌────┴──────────┐
   │ React Dashboard│  ← management UI
   └───────────────┘
        │ REST API
   ┌────┴──────────┐
   │ Gateway       │  ← FastAPI + FastMCP
   │ /api/*        │     auth, audit, aggregation
   │ /mcp          │     single MCP endpoint
   └────┬──────────┘
        │ cluster-internal only
   ┌────┴─────────────────────────────┐
   │  WooCommerce MCP  Time  Fetch    │  ← upstream MCP servers
   └──────────────────────────────────┘
        │
   WordPress + WooCommerce (MariaDB)
```

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Docker | 24+ | [docs.docker.com](https://docs.docker.com) |
| kind | 0.20+ | `brew install kind` |
| kubectl | v1.28+ | `brew install kubectl` |
| Helm | 4+ | `brew install helm` |
| Node.js | 20+ | `brew install node` |
| Python | 3.10+ (3.12 recommended for services) | `brew install python@3.12` |

---

## Quick Start — Local Kubernetes (kind)

```bash
# 1. Clone and enter the repo
git clone <repo-url> NexusMCP && cd NexusMCP

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — at minimum set LLM_PROVIDER and credentials

# 3. Run the bootstrap script (creates cluster, installs ingress, deploys everything)
./scripts/setup-local.sh
```

After setup, add these entries to `/etc/hosts`:
```
127.0.0.1  store.nexusmcp.local:9080
127.0.0.1  api.nexusmcp.local:9080
127.0.0.1  app.nexusmcp.local:9080
```

| URL | Service |
|---|---|
| http://store.nexusmcp.local:9080 | WordPress / WooCommerce storefront |
| http://app.nexusmcp.local:9080 | NexusMCP Dashboard |
| http://api.nexusmcp.local:9080/mcp | MCP Gateway endpoint |
| http://api.nexusmcp.local:9080/docs | Gateway API docs |

---

## LLM Configuration

NexusMCP supports two LLM providers. Set `LLM_PROVIDER` in your `.env`:

### Google Gemini (default)
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.0-flash   # or gemini-2.5-pro
```
Get a key at [aistudio.google.com](https://aistudio.google.com).

### Ollama (local, no API key needed)
```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1   # any model with tool-calling support
```
Install Ollama: `brew install ollama`, then `ollama pull llama3.1`.

---

## Manual Helm Deployment

```bash
# Local (kind)
helm upgrade --install nexusmcp ./helm/nexusmcp \
  -f helm/nexusmcp/values-local.yaml \
  --namespace nexusmcp --create-namespace

# Production-like (k3s VPS)
helm upgrade --install nexusmcp ./helm/nexusmcp \
  -f helm/nexusmcp/values-production.yaml \
  --namespace nexusmcp --create-namespace \
  --set secrets.geminiApiKey=$GEMINI_API_KEY \
  --set secrets.postgresPassword=$POSTGRES_PASSWORD
```

---

## Project Structure

```
NexusMCP/
├── services/
│   ├── woocommerce-mcp/   # WooCommerce MCP server (Python, FastMCP)
│   ├── gateway/           # MCP Gateway + Platform API (Python, FastAPI)
│   ├── time-mcp/          # Time MCP server (lightweight)
│   └── fetch-mcp/         # Fetch MCP server (controlled HTTP fetch)
├── frontend/              # React dashboard (TypeScript, Tailwind, shadcn/ui)
├── helm/nexusmcp/         # Umbrella Helm chart
├── docs/                  # Architecture, security, deployment, testing docs
├── scripts/               # Setup and utility scripts
├── tests/e2e/             # End-to-end acceptance tests
└── .env.example           # Environment variable reference
```

---

## Documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)

---

## Development

```bash
# Run gateway locally (with hot reload)
cd services/gateway
pip install -e ".[dev]"
uvicorn gateway.main:app --reload --port 8000

# Run frontend dev server
cd frontend
npm install && npm run dev

# Run tests
pytest services/gateway/tests/ -v
pytest tests/e2e/ -v
```
