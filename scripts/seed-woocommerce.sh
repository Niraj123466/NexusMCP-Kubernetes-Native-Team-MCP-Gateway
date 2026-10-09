#!/usr/bin/env bash
# scripts/seed-woocommerce.sh
# Bootstraps WordPress + WooCommerce in Kubernetes, generates API keys,
# and updates the nexusmcp-secrets Secret.
set -euo pipefail

NAMESPACE="nexusmcp"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

info "Waiting for WordPress pod to be ready..."
kubectl wait --namespace "$NAMESPACE" \
  --for=condition=ready pod \
  --selector=app=wordpress \
  --timeout=180s

WP_POD=$(kubectl get pod -n "$NAMESPACE" -l app=wordpress -o jsonpath='{.items[0].metadata.name}')
info "WordPress pod: $WP_POD"

# Check if wp-cli is installed in container
if ! kubectl exec -n "$NAMESPACE" "$WP_POD" -- which wp &>/dev/null; then
  info "Installing wp-cli inside $WP_POD..."
  kubectl exec -n "$NAMESPACE" "$WP_POD" -- bash -c \
    "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp"
fi

# Run core install if not already installed
info "Checking WordPress installation..."
if ! kubectl exec -n "$NAMESPACE" "$WP_POD" -- wp core is-installed --allow-root &>/dev/null; then
  info "Installing WordPress core..."
  kubectl exec -n "$NAMESPACE" "$WP_POD" -- wp core install \
    --url="http://store.nexusmcp.local:9080" \
    --title="NexusMCP Store" \
    --admin_user="admin" \
    --admin_password="AdminPassword123!" \
    --admin_email="admin@nexusmcp.local" \
    --skip-email \
    --allow-root
fi

# Install and activate WooCommerce
info "Installing & activating WooCommerce 9.4.0..."
kubectl exec -n "$NAMESPACE" "$WP_POD" -- wp plugin install https://downloads.wordpress.org/plugin/woocommerce.9.4.0.zip --activate --allow-root || true

# Set permalinks to pretty structure (required for WooCommerce REST API)
info "Configuring rewrite structure..."
kubectl exec -n "$NAMESPACE" "$WP_POD" -- wp rewrite structure '/%postname%/' --allow-root

# Generate or retrieve REST API key for user 1 (admin)
info "Creating WooCommerce REST API key..."
KEYS_OUTPUT=$(kubectl exec -n "$NAMESPACE" "$WP_POD" -- wp rc rest-api-key create \
  --user=1 \
  --description="NexusMCP Gateway Key" \
  --permissions=read_write \
  --porcelain \
  --allow-root 2>/dev/null || true)

# If wp rc command is not available, generate via MySQL directly or PHP script
if [[ -z "$KEYS_OUTPUT" ]]; then
  info "Generating API keys via PHP helper..."
  PHP_SCRIPT='
  require_once("/var/www/html/wp-load.php");
  global $wpdb;
  $user = get_user_by("login", "admin");
  $ck = "ck_" . bin2hex(random_bytes(20));
  $cs = "cs_" . bin2hex(random_bytes(20));
  $hash = hash_hmac("sha256", $ck, "wc-api");
  $wpdb->insert(
      $wpdb->prefix . "woocommerce_api_keys",
      array(
          "user_id"         => $user->ID,
          "description"     => "NexusMCP Key",
          "permissions"     => "read_write",
          "consumer_key"    => $hash,
          "consumer_secret" => $cs,
          "truncated_key"   => substr($ck, -7),
      ),
      array("%d", "%s", "%s", "%s", "%s", "%s")
  );
  echo $ck . ":" . $cs;
  '
  KEYS_OUTPUT=$(kubectl exec -n "$NAMESPACE" "$WP_POD" -- php -r "$PHP_SCRIPT")
fi

CK=$(echo "$KEYS_OUTPUT" | cut -d: -f1)
CS=$(echo "$KEYS_OUTPUT" | cut -d: -f2)

if [[ -n "$CK" && -n "$CS" ]]; then
  info "Generated WooCommerce credentials:"
  info "Consumer Key:    $CK"
  info "Consumer Secret: ${CS:0:10}..."

  # Update Kubernetes secret
  info "Updating nexusmcp-secrets in namespace '$NAMESPACE'..."
  kubectl get secret nexusmcp-secrets -n "$NAMESPACE" -o json | \
    jq --arg ck "$CK" --arg cs "$CS" \
    '.data.WC_CONSUMER_KEY = ($ck | @base64) | .data.WC_CONSUMER_SECRET = ($cs | @base64)' | \
    kubectl apply -f -

  # Restart woocommerce-mcp pod to pick up new secrets
  kubectl rollout restart deployment/woocommerce-mcp -n "$NAMESPACE" || true
  info "WooCommerce setup complete!"
else
  warn "Could not auto-generate API keys. You can generate them manually in WP Admin."
fi
