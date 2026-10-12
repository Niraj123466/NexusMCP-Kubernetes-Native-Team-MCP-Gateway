# System Design and Tradeoffs

## 1. Architectural Choices

### Transport: Streamable HTTP (SSE) over Stdio
- **Decision:** All MCP communication (Gateway to Upstreams, and External Clients to Gateway) uses MCP Streamable HTTP / Server-Sent Events (SSE) over HTTP/JSON-RPC rather than stdio subprocess pipes.
- **Tradeoff:** Stdio is simple for single-node desktop apps (like Claude Desktop running local binaries), but in a Kubernetes cluster, subprocess spawning does not scale, violates container immutability, and cannot cross pod boundaries. Streamable HTTP allows independent horizontal scaling, health probes, zero-downtime rolling updates, and NetworkPolicy firewalling.

### Gateway Architecture: Centralized Aggregation Proxy vs. Distributed Sidecars
- **Decision:** A centralized Gateway Deployment (`services/gateway`) backed by PostgreSQL.
- **Tradeoff:** 
  - *Sidecar alternative:* Adding an MCP proxy sidecar to every pod increases memory overhead and requires configuring authentication across every pod.
  - *Central Gateway advantage:* Centralizes API key validation, role-based access control (admin vs. member), cryptographic audit logging, and tool namespacing in a single resilient control plane.

### Data Persistence: StatefulSets with Managed Migrations
- **Decision:** PostgreSQL 16 (for Gateway users, keys, upstreams, audit logs) and MariaDB 11 (for WooCommerce) run as Kubernetes `StatefulSet` workloads with PersistentVolumeClaims.
- **Tradeoff:** Running stateful databases in Kubernetes requires explicit storage classes and volume lifecycle management, but enables a completely turnkey, self-contained development and test environment deployable via a single Helm command.

---

## 2. Tool Aggregation, Routing, and Failure Handling

### Tool Namespace Collision Resolution
- **Problem:** If two upstreams expose a tool with the same name (e.g., `list_items` or `get_status`), the LLM would receive conflicting or ambiguous schemas.
- **Solution:** The Gateway automatically namespaces all discovered upstream tools using the pattern:
  ```
  <upstream_slug>__<tool_name>
  ```
  Example: `woocommerce__list_products`, `time__get_current_time`, `fetch__read_url`.
- **Routing:** When an incoming JSON-RPC `tools/call` request arrives, the Gateway splits on the `__` delimiter, resolves the matching upstream server from the active pool, strips the prefix, and forwards the clean request.

### Timeout and Dead Upstream Resilience
- **Timeouts:** Upstream HTTP calls enforce strict timeouts: 3.0s connect timeout and 15.0s execution timeout.
- **Dead Upstream Isolation:** If an upstream server crashes, returns 5xx, or fails its readiness probe:
  - The Gateway marks the upstream as `offline` in the memory cache.
  - Other upstreams continue serving tools without interruption.
  - The tool call returns an explicit JSON-RPC error payload (`504 Gateway Timeout` or `502 Bad Gateway`) explaining which upstream failed.
  - The Chat Agent receives this structured error and gracefully explains the failure to the user rather than crashing the session.

---

## 3. Local to Production Strategy (What Changes)

| Dimension | Local (`kind` / `values-local.yaml`) | Production VPS (`k3s` / Cloud / `values-production.yaml`) |
| :--- | :--- | :--- |
| **Ingress & DNS** | NGINX Ingress on port `9080`/`9443` with `/etc/hosts` aliases (`*.nexusmcp.local`) | Cloud Ingress controller / Cert-Manager Let's Encrypt TLS on ports `80`/`443` with public DNS (`nexusmcp.nirajmore.in`) |
| **Storage Class** | `standard` / `local-path` provisioner on host Docker volume | Cloud CSI (`gp3`, `standard-rwo`, Ceph RBD) with automated snapshot policies |
| **Secrets Management**| Plaintext Helm values / local `.env` | External Secrets Operator (ESO), HashiCorp Vault, or AWS Secrets Manager with KMS encryption |
| **Replicas & Resources**| Single replica (1 pod per service), low memory limits (128Mi - 512Mi) | Multi-replica Gateway (2-5 pods) with HPA (Horizontal Pod Autoscaler) and PodDisruptionBudgets |
| **Database HA** | Single-pod StatefulSet with local PVC | Managed cloud databases (AWS RDS PostgreSQL / Aurora) or Stolon / CloudNativePG operator |
| **Upgrades & Rollback** | Immediate local helm upgrade | Progressive canary deployment via ArgoCD / Helm with automated `helm rollback` on probe failures |
