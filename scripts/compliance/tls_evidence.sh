#!/usr/bin/env bash
set -euo pipefail

PROD_HOST="${1:?prod host is required}"
STAGE_HOST="${2:?stage host is required}"
OUT_DIR="docs/compliance/zoom-beta/evidence"
RAW_FILE="$OUT_DIR/tls-check-latest.txt"
SUMMARY_FILE="$OUT_DIR/tls-summary-latest.md"

mkdir -p "$OUT_DIR"

check_host() {
  local host="$1"
  {
    echo "=== ${host} TLS1.2 ==="
    timeout 20 openssl s_client -connect "${host}:443" -servername "$host" -tls1_2 </dev/null 2>&1 || true
    echo "=== ${host} TLS1.1 ==="
    timeout 20 openssl s_client -connect "${host}:443" -servername "$host" -tls1_1 </dev/null 2>&1 || true
    echo
  } >> "$RAW_FILE"
}

: > "$RAW_FILE"
check_host "$PROD_HOST"
check_host "$STAGE_HOST"

DATE_UTC="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"

{
  echo "# TLS Evidence Summary"
  echo
  echo "Generated: ${DATE_UTC}"
  echo
  echo "Hosts: \
- ${PROD_HOST} \
- ${STAGE_HOST}"
  echo
  echo "Raw log: \
- \\`tls-check-latest.txt\\`"
  echo
  echo "## Quick checks"
  if grep -q "Protocol  : TLSv1.2" "$RAW_FILE"; then
    echo "- TLS 1.2 handshake: detected in output."
  else
    echo "- TLS 1.2 handshake: not detected, manual review required."
  fi

  if grep -q "TLSv1.1" "$RAW_FILE" && ! grep -qi "alert\|handshake failure\|no protocols available" "$RAW_FILE"; then
    echo "- TLS 1.1 may be enabled: manual review required."
  else
    echo "- TLS 1.1 appears blocked or failed (verify raw output)."
  fi
} > "$SUMMARY_FILE"

echo "Generated: $RAW_FILE"
echo "Generated: $SUMMARY_FILE"
