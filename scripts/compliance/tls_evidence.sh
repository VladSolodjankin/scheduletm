#!/usr/bin/env bash
set -uo pipefail

PROD_HOST="${1:?prod host is required}"
STAGE_HOST="${2:?stage host is required}"
OUT_DIR="${TLS_EVIDENCE_OUT_DIR:-docs/compliance/zoom-beta/evidence}"
RAW_FILE="$OUT_DIR/tls-check-latest.txt"
SUMMARY_FILE="$OUT_DIR/tls-summary-latest.md"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
TIMEOUT_BIN="${TIMEOUT_BIN:-timeout}"

mkdir -p "$OUT_DIR"
: > "$RAW_FILE"

overall_status=0
summary_rows=()

run_probe() {
  local host="$1"
  local protocol="$2"
  local option="$3"
  local probe_file
  local probe_status

  probe_file="$(mktemp)"
  "$TIMEOUT_BIN" 20 "$OPENSSL_BIN" s_client \
    -connect "${host}:443" -servername "$host" "$option" \
    </dev/null >"$probe_file" 2>&1
  probe_status=$?

  {
    echo "=== ${host} ${protocol} (exit=${probe_status}) ==="
    cat "$probe_file"
    echo
  } >> "$RAW_FILE"

  PROBE_STATUS="$probe_status"
  PROBE_OUTPUT="$(cat "$probe_file")"
  rm -f "$probe_file"
}

check_host() {
  local host="$1"
  local tls12_result="FAIL"
  local tls11_result="FAIL"

  run_probe "$host" "TLS1.2" "-tls1_2"
  if [ "$PROBE_STATUS" -eq 0 ] &&
    grep -Eqi 'Protocol([[:space:]]*:| version:)[[:space:]]*TLSv1\.2' <<<"$PROBE_OUTPUT"; then
    tls12_result="PASS"
  else
    overall_status=1
  fi

  run_probe "$host" "TLS1.1" "-tls1_1"
  if grep -Eqi '^CONNECTED([[:space:](]|$)' <<<"$PROBE_OUTPUT" &&
    grep -Eqi 'alert protocol version|tlsv1 alert protocol version|alert number 70' <<<"$PROBE_OUTPUT" &&
    ! grep -Eqi 'Protocol([[:space:]]*:| version:)[[:space:]]*TLSv1\.1' <<<"$PROBE_OUTPUT"; then
    tls11_result="PASS"
  else
    overall_status=1
  fi

  summary_rows+=("| \`${host}\` | ${tls12_result} | ${tls11_result} |")
}

check_host "$PROD_HOST"
check_host "$STAGE_HOST"

DATE_UTC="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
{
  echo "# TLS Evidence Summary"
  echo
  echo "Generated: ${DATE_UTC}"
  echo
  echo "| Host | TLS 1.2 handshake succeeds | TLS 1.1 handshake rejected |"
  echo "| --- | --- | --- |"
  printf '%s\n' "${summary_rows[@]}"
  echo
  echo "Raw log: \`tls-check-latest.txt\`"
  echo
  if [ "$overall_status" -eq 0 ]; then
    echo "Overall result: PASS"
  else
    echo "Overall result: FAIL"
  fi
} > "$SUMMARY_FILE"

echo "Generated: $RAW_FILE"
echo "Generated: $SUMMARY_FILE"
exit "$overall_status"
