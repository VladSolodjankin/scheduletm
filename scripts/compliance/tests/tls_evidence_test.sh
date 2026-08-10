#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TLS_SCRIPT="$SCRIPT_DIR/../tls_evidence.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

cat > "$TEST_ROOT/fake-openssl" <<'EOF'
#!/usr/bin/env bash
host=""
protocol=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -connect) host="${2%%:*}"; shift 2 ;;
    -tls1_2) protocol="TLSv1.2"; shift ;;
    -tls1_1) protocol="TLSv1.1"; shift ;;
    *) shift ;;
  esac
done

if [ "$protocol" = "TLSv1.2" ] && [ "$host" != "bad.example" ]; then
  echo "Protocol version: TLSv1.2"
  exit 0
fi
if [ "$protocol" = "TLSv1.1" ] && [ "$host" = "legacy.example" ]; then
  echo "CONNECTED(00000003)"
  echo "Protocol  : TLSv1.1"
  exit 0
fi
if [ "$protocol" = "TLSv1.1" ] && [ "$host" = "timeout.example" ]; then
  echo "connect: Connection timed out"
  exit 124
fi
if [ "$protocol" = "TLSv1.1" ] && [ "$host" = "unsupported.example" ]; then
  echo "s_client: Unknown option: -tls1_1"
  exit 1
fi
if [ "$protocol" = "TLSv1.1" ]; then
  echo "CONNECTED(00000003)"
  echo "error:0A00042E:SSL routines:tlsv1 alert protocol version"
  echo "SSL alert number 70"
  exit 1
fi
echo "connect: Connection refused"
exit 1
EOF
chmod +x "$TEST_ROOT/fake-openssl"

# Fixture wrapper that discards the timeout duration.
cat > "$TEST_ROOT/fake-timeout" <<'EOF'
#!/usr/bin/env bash
shift
exec "$@"
EOF
chmod +x "$TEST_ROOT/fake-timeout"
TIMEOUT_BIN="$TEST_ROOT/fake-timeout"

run_case_with_timeout() {
  local name="$1" expected_status="$2" first_host="$3" second_host="$4"
  local case_dir="$TEST_ROOT/$name" actual_status=0
  mkdir -p "$case_dir"
  TLS_EVIDENCE_OUT_DIR="$case_dir" OPENSSL_BIN="$TEST_ROOT/fake-openssl" \
    TIMEOUT_BIN="$TIMEOUT_BIN" bash "$TLS_SCRIPT" "$first_host" "$second_host" >/dev/null ||
    actual_status=$?
  [ "$actual_status" -eq "$expected_status" ] || {
    echo "$name: expected exit $expected_status, got $actual_status" >&2
    exit 1
  }
  test -s "$case_dir/tls-check-latest.txt"
  grep -q "Overall result:" "$case_dir/tls-summary-latest.md"
}

run_case_with_timeout pass 0 good.example other.example
run_case_with_timeout tls12_failure 1 good.example bad.example
run_case_with_timeout tls11_enabled 1 good.example legacy.example
run_case_with_timeout tls11_timeout 1 good.example timeout.example
run_case_with_timeout tls11_local_unsupported 1 good.example unsupported.example
echo "tls_evidence fixtures: PASS"
