#!/usr/bin/env bash
# scripts/setup-local.sh
# One-shot bootstrap for local Kubernetes development using kind.
# Run from the repo root: ./scripts/setup-local.sh
set -euo pipefail

CLUSTER_NAME="nexusmcp"
NAMESPACE="nexusmcp"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIND_CONFIG="${REPO_ROOT}/helm/kind-cluster.yaml"

# ── Colour helpers ────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Check prerequisites ───────────────────────────────────────
info "Checking prerequisites..."
for cmd in docker kind kubectl helm; do
  command -v "$cmd" &>/dev/null || error "'$cmd' is not installed. See README.md → Prerequisites."
done

# ── Load .env ─────────────────────────────────────────────────
ENV_FILE="${REPO_ROOT}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  error ".env not found. Copy .env.example to .env and fill in values."
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# ── Create kind cluster ───────────────────────────────────────
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  warn "Kind cluster '${CLUSTER_NAME}' already exists — skipping creation."
else
  info "Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "$CLUSTER_NAME" --config "$KIND_CONFIG"
fi

# Set kubectl context
kubectl config use-context "kind-${CLUSTER_NAME}"
info "kubectl context → kind-${CLUSTER_NAME}"

# ── Install NGINX Ingress Controller ─────────────────────────
info "Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.3/deploy/static/provider/kind/deploy.yaml

info "Waiting for ingress-nginx to become ready (up to 90s)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# ── Create namespace ──────────────────────────────────────────
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ── Create Kubernetes Secrets ─────────────────────────────────
info "Creating Kubernetes Secrets in namespace '${NAMESPACE}'..."
kubectl create secret generic nexusmcp-secrets \
  --namespace "$NAMESPACE" \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set in .env}" \
  --from-literal=MARIADB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:?not set}" \
  --from-literal=MARIADB_PASSWORD="${MARIADB_PASSWORD:?not set}" \
  --from-literal=WC_CONSUMER_KEY="${WC_CONSUMER_KEY:-placeholder}" \
  --from-literal=WC_CONSUMER_SECRET="${WC_CONSUMER_SECRET:-placeholder}" \
  --from-literal=GATEWAY_SECRET_KEY="${GATEWAY_SECRET_KEY:?not set}" \
  --from-literal=GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
  --from-literal=OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434}" \
  --from-literal=OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1}" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── Deploy via Helm ───────────────────────────────────────────
info "Deploying NexusMCP via Helm..."
helm upgrade --install nexusmcp "${REPO_ROOT}/helm/nexusmcp" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  -f "${REPO_ROOT}/helm/nexusmcp/values-local.yaml" \
  --wait --timeout 5m

# ── /etc/hosts reminder ───────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────────────"
echo "  Add these entries to /etc/hosts:"
echo "────────────────────────────────────────────────────────"
echo "  127.0.0.1  store.nexusmcp.local:9080"
echo "  127.0.0.1  api.nexusmcp.local:9080"
echo "  127.0.0.1  app.nexusmcp.local:9080"
echo "────────────────────────────────────────────────────────"
echo ""
info "Setup complete! Dashboard → http://app.nexusmcp.local:9080"
