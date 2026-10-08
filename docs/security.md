# Security

## Threat Model

NexusMCP is a multi-tenant gateway that forwards tool calls to internal services on behalf of authenticated users. The key threats addressed are:

| Threat | Mitigation |
|---|---|
| Unauthenticated access to gateway | Every request requires a valid `X-API-Key` header |
| Stolen API key | Keys are bcrypt-hashed; plaintext never stored. Revocation is immediate |
| Privilege escalation (member → admin) | Role checked server-side from DB; client-supplied user ID is never trusted |
| SSRF via upstream registration | SSRF guard blocks loopback, RFC1918, link-local, cloud metadata before connect |
| DNS rebinding | IP re-validated after DNS resolution; gateway binds to resolved IP |
| Upstream credential leakage | Auth tokens stored encrypted in DB; never returned to browsers or MCP clients |
| Tool injection via untrusted upstream | Upstream tool descriptions treated as untrusted strings; not executed |
| Audit evasion | All tool calls go through the aggregator which writes audit logs atomically |
| Secret exposure in logs | API keys, passwords, and auth headers are explicitly excluded from log fields |
| Container escape | All containers run as non-root; minimal base images; read-only filesystems where possible |

---

## API Keys

- Generated with `secrets.token_urlsafe(32)` — 256 bits of entropy.
- Stored as `bcrypt` hash in `api_keys.key_hash`. The plaintext is shown once at issuance and then discarded.
- The prefix (first 8 characters) is stored in `api_keys.prefix` for identification in audit logs and UI, without exposing the full key.
- Revocation sets `api_keys.revoked_at`; the gateway checks this on every request.
- Keys are never logged, never included in error responses, never sent to LLM providers.

## Roles

| Role | Permissions |
|---|---|
| `admin` | Full CRUD on upstreams, users, keys, tool permissions. Read audit logs |
| `member` | Call tools through `/mcp`. View own audit log entries. Issue / revoke own keys |

Role is stored in the `users` table and loaded from the database on each request. It cannot be modified by the client.

## Upstream Credentials

Upstream servers may require a bearer token or custom HTTP headers for authentication. These are:
- Stored in `upstream_servers.auth_value_enc` using AES-256-GCM symmetric encryption.
- The encryption key is `GATEWAY_SECRET_KEY` (stored in a Kubernetes Secret, not in images).
- Never included in `GET /api/upstreams` responses to clients.
- Only decrypted in-process when forwarding a request to the upstream.

## SSRF Protection

The `mcp/ssrf_guard.py` module is called for every upstream URL at registration time and before each connection attempt.

Blocked ranges:
- `127.0.0.0/8` — loopback
- `::1/128` — IPv6 loopback
- `169.254.0.0/16` — link-local (AWS/GCP/Azure metadata)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` — RFC1918
- `0.0.0.0/8`
- `100.64.0.0/10` — shared address space
- `fd00::/8`, `fe80::/10` — IPv6 private / link-local

**DNS rebinding mitigation:** After resolving the hostname to an IP, the IP is validated through the same blocklist. The connection is then made to the resolved IP directly with the `Host` header set to the original hostname.

**Allowlist:** `SSRF_INTERNAL_ALLOWLIST` env var contains comma-separated hostnames of known-safe cluster-internal services (e.g., `woocommerce-mcp-svc`). These bypass the RFC1918 block because they are controlled services.

## Kubernetes Secrets

All credentials are stored in Kubernetes Secrets:

```
nexusmcp-secrets:
  POSTGRES_PASSWORD
  MARIADB_ROOT_PASSWORD
  MARIADB_PASSWORD
  WC_CONSUMER_KEY
  WC_CONSUMER_SECRET
  GATEWAY_SECRET_KEY
  GEMINI_API_KEY     (if LLM_PROVIDER=gemini)
```

For production, integrate with an external secret manager (e.g., Sealed Secrets, Vault Agent Injector, or AWS Secrets Manager CSI driver) to avoid storing plaintext base64 in cluster ETCD.

## What Is Never Logged

- Full API keys (only the 8-char prefix)
- Passwords or secrets
- `Authorization` headers from upstream requests
- Full tool call arguments (only an HMAC hash of args is stored for auditability without exposing PII)

## Production Checklist

- [ ] TLS on all Ingress routes (cert-manager + Let's Encrypt)
- [ ] Network Policies enforced (verify with `kubectl describe networkpolicy`)
- [ ] Secrets stored in external secret manager
- [ ] Audit log retention policy configured (PostgreSQL row expiry or export to S3)
- [ ] RBAC limited to minimum necessary ServiceAccounts
- [ ] Container images scanned for CVEs before deployment
