# Deployment

## Local Kubernetes (kind)

### One-shot bootstrap

```bash
./scripts/setup-local.sh
```

This script:
1. Creates the `nexusmcp` kind cluster using `helm/kind-cluster.yaml`.
2. Installs the NGINX Ingress Controller.
3. Waits for ingress pods to become ready.
4. Creates the `nexusmcp` namespace and applies Kubernetes Secrets from your `.env`.
5. Runs `helm upgrade --install` with `values-local.yaml`.
6. Configures WordPress via WP-CLI (pretty permalinks, WooCommerce activation).
7. Prints the `/etc/hosts` entries to add.

### Manual Helm deployment

```bash
# Create namespace and secrets first
kubectl create namespace nexusmcp

kubectl create secret generic nexusmcp-secrets -n nexusmcp \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=MARIADB_ROOT_PASSWORD="$MARIADB_ROOT_PASSWORD" \
  --from-literal=MARIADB_PASSWORD="$MARIADB_PASSWORD" \
  --from-literal=WC_CONSUMER_KEY="$WC_CONSUMER_KEY" \
  --from-literal=WC_CONSUMER_SECRET="$WC_CONSUMER_SECRET" \
  --from-literal=GATEWAY_SECRET_KEY="$GATEWAY_SECRET_KEY" \
  --from-literal=GEMINI_API_KEY="$GEMINI_API_KEY"

# Install
helm upgrade --install nexusmcp ./helm/nexusmcp \
  -n nexusmcp \
  -f helm/nexusmcp/values-local.yaml
```

### Add /etc/hosts entries

```
127.0.0.1  store.nexusmcp.local
127.0.0.1  api.nexusmcp.local
127.0.0.1  app.nexusmcp.local
```

---

## Production-like Deployment (k3s VPS)

### 1. Provision VPS

Minimum: 4 vCPU, 8 GB RAM, 60 GB SSD. Ubuntu 22.04 recommended.

### 2. Install k3s

```bash
curl -sfL https://get.k3s.io | sh -s - \
  --disable traefik \
  --write-kubeconfig-mode 644
```

Copy `/etc/rancher/k3s/k3s.yaml` to your local `~/.kube/config` (update server IP).

### 3. Install NGINX Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer
```

### 4. Install cert-manager (optional but recommended)

```bash
helm repo add jetstack https://charts.jetstack.io
helm upgrade --install cert-manager jetstack/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true
```

### 5. Deploy NexusMCP

```bash
helm upgrade --install nexusmcp ./helm/nexusmcp \
  -n nexusmcp --create-namespace \
  -f helm/nexusmcp/values-production.yaml \
  --set global.domain=yourdomain.com \
  --set secrets.geminiApiKey="$GEMINI_API_KEY" \
  --set secrets.postgresPassword="$POSTGRES_PASSWORD" \
  # ... other secrets
```

---

## Storage

| PVC | Size (local) | Size (production) | Access Mode |
|---|---|---|---|
| `wordpress-pvc` | 5 Gi | 20 Gi | ReadWriteOnce |
| `mariadb-pvc` | 10 Gi | 50 Gi | ReadWriteOnce |
| `postgres-pvc` | 5 Gi | 20 Gi | ReadWriteOnce |

**Important:** PVCs are not deleted when a Helm release is uninstalled. To delete data, manually run `kubectl delete pvc -n nexusmcp --all`.

---

## Upgrades

```bash
# Pull latest chart, then upgrade
helm upgrade nexusmcp ./helm/nexusmcp -n nexusmcp -f helm/nexusmcp/values-local.yaml
```

Database migrations run automatically as a Kubernetes Job (`alembic upgrade head`) before the gateway Deployment rolls out. This is controlled by a Helm hook (`helm.sh/hook: pre-upgrade`).

---

## Rollbacks

```bash
# List revisions
helm history nexusmcp -n nexusmcp

# Roll back to previous revision
helm rollback nexusmcp 0 -n nexusmcp
```

**Note:** Helm rollback does not reverse database migrations. After rollback, run the previous migration manually if needed.

---

## Ollama (Local LLM)

To use Ollama instead of Gemini:

**Option A — Run on your laptop (outside cluster):**
```bash
brew install ollama
ollama pull llama3.1
ollama serve  # starts on localhost:11434
```

In `values-local.yaml`:
```yaml
gateway:
  env:
    LLM_PROVIDER: "ollama"
    OLLAMA_BASE_URL: "http://host.docker.internal:11434"
    OLLAMA_MODEL: "llama3.1"
```

**Option B — Run inside the cluster (GPU node):**
```yaml
# values-local.yaml
ollama:
  enabled: true
  image: ollama/ollama:latest
  model: llama3.1
gateway:
  env:
    LLM_PROVIDER: "ollama"
    OLLAMA_BASE_URL: "http://ollama-svc:11434"
```
