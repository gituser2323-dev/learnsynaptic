#!/usr/bin/env bash
# Apply vendor keys into .env.staging.local (gitignored). Never prints secret values.
# Usage:
#   ./scripts/staging/apply-vendor-keys.sh \
#     --cloudinary-key KEY --cloudinary-secret SECRET \
#     --razorpay-key-id rzp_test_... --razorpay-key-secret SECRET \
#     --razorpay-webhook-secret SECRET
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/.env.staging.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

CLOUDINARY_KEY=""
CLOUDINARY_SECRET=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
ENABLE_CLOUDINARY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cloudinary-key) CLOUDINARY_KEY="$2"; shift 2 ;;
    --cloudinary-secret) CLOUDINARY_SECRET="$2"; shift 2 ;;
    --razorpay-key-id) RAZORPAY_KEY_ID="$2"; shift 2 ;;
    --razorpay-key-secret) RAZORPAY_KEY_SECRET="$2"; shift 2 ;;
    --razorpay-webhook-secret) RAZORPAY_WEBHOOK_SECRET="$2"; shift 2 ;;
    --enable-cloudinary) ENABLE_CLOUDINARY=1; shift ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

python3 - "$ENV_FILE" "$CLOUDINARY_KEY" "$CLOUDINARY_SECRET" "$RAZORPAY_KEY_ID" "$RAZORPAY_KEY_SECRET" "$RAZORPAY_WEBHOOK_SECRET" "$ENABLE_CLOUDINARY" <<'PY'
import re, sys
from pathlib import Path
path, c_key, c_sec, r_id, r_sec, r_wh, enable = sys.argv[1:8]
text = Path(path).read_text()

def set_key(text: str, key: str, value: str) -> str:
    if value == "":
        return text
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    line = f"{key}={value}"
    if pat.search(text):
        return pat.sub(line, text, count=1)
    return text.rstrip() + "\n" + line + "\n"

updates = {
    "CLOUDINARY_API_KEY": c_key,
    "CLOUDINARY_API_SECRET": c_sec,
    "RAZORPAY_KEY_ID": r_id,
    "RAZORPAY_KEY_SECRET": r_sec,
    "RAZORPAY_WEBHOOK_SECRET": r_wh,
}
for k, v in updates.items():
    text = set_key(text, k, v)

# Cloud name already known for this MCP-linked account
text = set_key(text, "CLOUDINARY_CLOUD_NAME", "deius3dpz")

if enable == "1" and c_key and c_sec:
    text = set_key(text, "STORAGE_PROVIDER", "cloudinary")

Path(path).write_text(text)

def status(v: str) -> str:
    return "SET" if v else "skipped"

print("Updated .env.staging.local (values not printed):")
print(f"  CLOUDINARY_CLOUD_NAME=deius3dpz")
print(f"  CLOUDINARY_API_KEY={status(c_key)}")
print(f"  CLOUDINARY_API_SECRET={status(c_sec)}")
print(f"  RAZORPAY_KEY_ID={status(r_id)}")
print(f"  RAZORPAY_KEY_SECRET={status(r_sec)}")
print(f"  RAZORPAY_WEBHOOK_SECRET={status(r_wh)}")
if enable == "1" and c_key and c_sec:
    print("  STORAGE_PROVIDER=cloudinary")
print()
print("Razorpay webhook URL (local tunnel or hosted staging):")
print("  {APP_BASE_URL}/api/webhooks/payments/razorpay")
print("Events: payment.captured, payment.failed, refund.created (as used by adapter)")
PY
