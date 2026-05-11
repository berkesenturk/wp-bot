#!/usr/bin/env bash
# wp — WhatsApp bot CLI for EC2
# Usage: wp <command> [args]
#   wp status             show connection + indexing status
#   wp pair [phone]       link a WhatsApp account (interactive if phone omitted)
#   wp connect            reconnect to WhatsApp
#   wp reset              clear WhatsApp session (keeps messages and vectors)
#   wp disconnect         logout and wipe ALL data (prompts for confirmation)
#   wp logs [-f]          show container logs (pass -f to follow)
#   wp index              show embedding index health
set -euo pipefail

API="http://localhost:3000/api"

json() { command -v jq &>/dev/null && jq '.' || cat; }

_extract() { # _extract <field> <json>
  if command -v jq &>/dev/null; then
    echo "$2" | jq -r ".${1} // empty" 2>/dev/null
  else
    echo "$2" | grep -o "\"${1}\":\"[^\"]*\"" | cut -d'"' -f4
  fi
}

_is_connected() {
  curl -sf "${API}/status" 2>/dev/null | grep -q '"connected":true'
}

case "${1:-help}" in

  status)
    echo "=== Connection ==="
    curl -sf "${API}/status" | json
    echo ""
    echo "=== Index ==="
    curl -sf "${API}/search/status" | json
    ;;

  pair)
    # Resolve phone: arg > env file > interactive prompt
    PHONE="${2:-}"
    if [ -z "${PHONE}" ] && [ -f /etc/wp-bot.env ]; then
      PHONE=$(grep -E '^PHONE_NUMBER=' /etc/wp-bot.env | cut -d= -f2 | tr -d '[:space:]' || true)
    fi
    if [ -z "${PHONE}" ]; then
      printf "Phone number (country code + digits, no + or spaces): " >&2
      read -r PHONE
    fi
    PHONE="${PHONE//[^0-9]/}"
    if [ -z "${PHONE}" ]; then
      echo "Error: phone number required (e.g. 905551234567)" >&2
      exit 1
    fi

    # Check already connected
    if _is_connected; then
      echo "Already connected to WhatsApp. Run 'wp reset' first to re-link a different account."
      exit 0
    fi

    # Wait up to 15 s for the socket to initialise after server start
    echo "Checking server..."
    for i in $(seq 1 8); do
      HTTP=$(curl -so /dev/null -w "%{http_code}" -X POST "${API}/pair" \
             -H 'Content-Type: application/json' \
             -d "{\"phone\":\"${PHONE}\"}" 2>/dev/null || echo "000")
      [ "${HTTP}" != "503" ] && [ "${HTTP}" != "000" ] && break
      sleep 2
    done

    RESULT=$(curl -sf -X POST "${API}/pair" \
      -H 'Content-Type: application/json' \
      -d "{\"phone\":\"${PHONE}\"}" 2>&1) || {
      echo "Error: could not reach the bot server. Is it running? Try: wp logs" >&2
      exit 1
    }

    ERR=$(_extract error "$RESULT")
    if [ -n "${ERR}" ]; then
      if [ "${ERR}" = "already_connected" ]; then
        echo "Already connected. Run 'wp reset' first to re-link."
      else
        echo "Error: ${ERR}" >&2
        exit 1
      fi
      exit 0
    fi

    CODE=$(_extract code "$RESULT")
    if [ -z "${CODE}" ]; then
      echo "Error: unexpected response — ${RESULT}" >&2
      exit 1
    fi

    echo ""
    echo "  ╔════════════════════════════════════════╗"
    echo "  ║   WHATSAPP PAIRING CODE                ║"
    echo "  ║                                        ║"
    printf  "  ║       %-32s  ║\n" "${CODE}"
    echo "  ║                                        ║"
    echo "  ╠════════════════════════════════════════╣"
    echo "  ║  On your phone:                        ║"
    echo "  ║  Settings → Linked Devices →           ║"
    echo "  ║  Link with phone number                ║"
    echo "  ╚════════════════════════════════════════╝"
    echo ""
    echo "Waiting for WhatsApp to connect (up to 60 s)..."

    for i in $(seq 1 30); do
      sleep 2
      if _is_connected; then
        echo ""
        echo "Connected! Activate the bot in any chat: @bot start"
        exit 0
      fi
      printf "."
    done
    echo ""
    echo "Timed out. Check 'wp logs -f' for details, or retry 'wp pair ${PHONE}'."
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
