# Testing

## Test Categories

| Category | Location | Runner |
|---|---|---|
| Unit (gateway) | `services/gateway/tests/unit/` | pytest |
| Unit (woocommerce-mcp) | `services/woocommerce-mcp/tests/` | pytest |
| Integration | `services/gateway/tests/integration/` | pytest (requires DB) |
| End-to-end acceptance | `tests/e2e/` | pytest (requires running cluster) |

---

## Running Unit Tests

```bash
# Gateway
cd services/gateway
pip install -e ".[dev]"
pytest tests/unit/ -v

# WooCommerce MCP
cd services/woocommerce-mcp
pip install -e ".[dev]"
pytest tests/ -v
```

---

## Running Integration Tests

Integration tests require a running PostgreSQL instance. Use Docker Compose for a quick local DB:

```bash
docker run -d --name nexusmcp-test-db \
  -e POSTGRES_DB=nexusmcp_test \
  -e POSTGRES_USER=nexusmcp \
  -e POSTGRES_PASSWORD=testpassword \
  -p 5432:5432 postgres:16

cd services/gateway
POSTGRES_HOST=localhost POSTGRES_PASSWORD=testpassword pytest tests/integration/ -v
```

---

## Running End-to-End Acceptance Tests

E2E tests run against a live cluster. Start the local cluster first (`./scripts/setup-local.sh`), then:

```bash
cd tests/e2e
pip install -r requirements.txt
pytest -v --tb=short
```

### Acceptance Test Scenarios

| # | Scenario | Test file |
|---|---|---|
| 1 | Product created via chat agent appears in storefront | `test_product_flow.py::test_create_product_via_chat` |
| 2 | Customer places order through WooCommerce checkout | `test_product_flow.py::test_customer_order` |
| 3 | Agent retrieves real order via `woocommerce__get_order` | `test_product_flow.py::test_agent_retrieves_order` |
| 4 | Two users authenticate independently | `test_auth.py::test_independent_authentication` |
| 5 | External MCP client uses gateway with API key only | `test_mcp_client.py::test_external_mcp_client` |
| 6 | All upstream tools visible through gateway endpoint | `test_mcp_client.py::test_all_tools_visible` |
| 7 | Single request uses tools from two different upstreams | `test_mcp_client.py::test_cross_upstream_request` |
| 8 | Revoking a key causes subsequent calls to fail | `test_auth.py::test_key_revocation` |
| 9 | Disabling upstream removes its tools | `test_acceptance.py::test_disable_upstream` |
| 10 | Stopping one upstream does not break others | `test_acceptance.py::test_upstream_isolation` |
| 11 | Dashboard shows accurate status and audit logs | `test_acceptance.py::test_dashboard_accuracy` |
| 12 | Full stack deployable via Helm locally | `test_acceptance.py::test_helm_deployment` |

---

## MCP Protocol Testing

Use the `mcp` CLI to test the gateway endpoint directly:

```bash
pip install "mcp[cli]"

# List tools
mcp tools http://api.nexusmcp.local/mcp \
  --header "X-API-Key: nexus_your_api_key"

# Call a tool
mcp call woocommerce__list_products \
  http://api.nexusmcp.local/mcp \
  --header "X-API-Key: nexus_your_api_key" \
  --params '{}'
```

---

## Code Quality

```bash
# Linting
ruff check services/

# Type checking
mypy services/gateway/src/ services/woocommerce-mcp/src/

# Frontend
cd frontend && npm run lint && npm run type-check
```
