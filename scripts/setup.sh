#!/usr/bin/env bash
# scripts/setup.sh — One-command setup for a new wp-bot deployment.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - AWS credentials configured (aws configure)
#   - Terraform installed
#
# Usage:
#   ./scripts/setup.sh \
#     --repo    <owner/repo>          \
#     --api-key <Mistral/Requesty key>\
#     --admin-ip <your-ip/32>
set -euo pipefail

usage() {
  sed -n '2,13p' "$0"
  exit 1
}

REPO="" API_KEY="" ADMIN_IP=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)     REPO="$2";     shift 2 ;;
    --api-key)  API_KEY="$2";  shift 2 ;;
    --admin-ip) ADMIN_IP="$2"; shift 2 ;;
    -h|--help)  usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

missing=""
[[ -z "$REPO" ]]     && missing+=" --repo"
[[ -z "$API_KEY" ]]  && missing+=" --api-key"
[[ -z "$ADMIN_IP" ]] && missing+=" --admin-ip"
if [[ -n "$missing" ]]; then
  echo "Error: missing required args:$missing" >&2
  usage
fi

for cmd in gh terraform aws; do
  command -v "$cmd" &>/dev/null || { echo "Error: '$cmd' not found — install it first." >&2; exit 1; }
done
gh auth status &>/dev/null || { echo "Error: run 'gh auth login' first." >&2; exit 1; }

echo "==> [1/4] Provisioning EC2 with Terraform..."
cd infra
terraform init -input=false
terraform apply -input=false -auto-approve \
  -var "github_repo=${REPO}" \
  -var "api_key=${API_KEY}" \
  -var "admin_ip=${ADMIN_IP}"

HOST=$(terraform output -raw ec2_host)
KEY_PEM=$(terraform output -raw ec2_ssh_key)
cd ..
echo "    EC2 public IP: ${HOST}"

echo "==> [2/4] Setting GitHub secrets..."
gh secret set EC2_HOST    --repo "$REPO" --body "$HOST"
gh secret set EC2_USER    --repo "$REPO" --body "ec2-user"
gh secret set EC2_SSH_KEY --repo "$REPO" --body "$KEY_PEM"
echo "    Done."

echo "==> [3/4] Triggering first deploy..."
gh workflow run deploy.yml --repo "$REPO"
sleep 8
RUN_ID=$(gh run list --repo "$REPO" --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
echo "    Watching run #${RUN_ID} (first run takes ~3 min — embedding model download)..."
gh run watch "$RUN_ID" --repo "$REPO" --exit-status

echo ""
echo "==> [4/4] Done! Link your WhatsApp account:"
echo ""
echo "    ssh -i <(cd infra && terraform output -raw ec2_ssh_key) ec2-user@${HOST}"
echo "    wp pair"
echo ""
echo "    Enter the code shown in WhatsApp:"
echo "    Settings → Linked Devices → Link with phone number"
echo ""
echo "After pairing, activate the bot in any chat: @bot start"
echo ""
echo "Note: if you stop/restart the EC2 instance its public IP will change."
echo "Update the secret with: gh secret set EC2_HOST --repo ${REPO} --body <new-ip>"
