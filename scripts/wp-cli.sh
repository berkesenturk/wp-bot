#!/usr/bin/env bash
# wp — WhatsApp bot CLI for EC2
# Usage: wp <command> [args]
#   wp status             show connection + indexing status
#   wp pair [phone]       request a pairing code (phone defaults to PHONE_NUMBER in /etc/wp-bot.env)
#   wp connect            reconnect to WhatsApp
#   wp reset              clear WhatsApp session (keeps messages and vectors)
#   wp disconnect         logout and wipe ALL data (prompts for confirmation)
#   wp logs [-f]          show container logs (pass -f to follow)
#   wp index              show embedding index health
set -euo pipefail

API="http://localhost:3000/api"

json() { command -v jq &>/dev/null && jq '.' || cat; }

case "${1:-help}" in

  status)
    echo "=== Connection ==="
    curl -sf "${API}/status" | json
    echo ""
    echo "=== Index ==="
    curl -sf "${API}/search/status" | json
    ;;

  pair)
    PHONE="${2:-}"
    if [ -z "${PHONE}" ] && [ -f /etc/wp-bot.env ]; then
      PHONE=$(grep -E '^PHONE_NUMBER=' /etc/wp-bot.env | cut -d= -f2 | tr -d '[:space:]')
    fi
    if [ -z "${PHONE}" ]; then
      echo "Usage: wp pair <phone>  (e.g. wp pair 905551234567)" >&2
      exit 1
    fi
    echo "Requesting pairing code for ${PHONE}..."
    curl -sf -X POST "${API}/pair" \
      -H 'Content-Type: application/json' \
      -d "{\"phone\":\"${PHONE}\"}" | json
    ;;

  connect)
    echo "Reconnecting..."
    curl -sf -X POST "${API}/connect" | json
    ;;

  reset)
    echo "Clearing WhatsApp session (messages and vectors are preserved)..."
    curl -sf -X POST "${API}/reset-auth" | json
    echo "Session cleared. Run 'wp pair' to re-link."
    ;;

  disconnect)
    echo "WARNING: This will logout and delete ALL messages, vectors, and session data."
    read -r -p "Type 'yes' to confirm: " CONFIRM
    if [ "${CONFIRM}" != "yes" ]; then
      echo "Aborted."
      exit 0
    fi
    curl -sf -X POST "${API}/disconnect" | json
    ;;

  logs)
    shift
    docker logs "${@}" wp-bot
    ;;

  index)
    curl -sf "${API}/search/status" | json
    ;;

  help|--help|-h)
    sed -n '3,12p' "$0"
    ;;

  *)
    echo "Unknown command: ${1}. Run 'wp help' for usage." >&2
    exit 1
    ;;
esac
