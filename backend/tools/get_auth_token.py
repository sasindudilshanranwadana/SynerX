
import os
import sys
import json
import requests
from dotenv import load_dotenv


def main() -> int:
    # Load environment variables from backend/.env if present
    # This allows using a .env file instead of setting shell env vars
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    email = os.getenv("SUPABASE_EMAIL")
    password = os.getenv("SUPABASE_PASSWORD")

    missing = [name for name, val in [
        ("SUPABASE_URL", supabase_url),
        ("SUPABASE_ANON_KEY/SUPABASE_KEY", anon_key),
        ("SUPABASE_EMAIL", email),
        ("SUPABASE_PASSWORD", password),
    ] if not val]
    if missing:
        print("ERROR: Missing env vars: " + ", ".join(missing), file=sys.stderr)
        return 1

    url = f"{supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    try:
        resp = requests.post(
            url,
            headers={
                "apikey": anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
            timeout=15,
        )
    except requests.RequestException as e:
        print(f"ERROR: Auth service unreachable: {e}", file=sys.stderr)
        return 2

    if resp.status_code != 200:
        print(f"ERROR: {resp.status_code} {resp.text}", file=sys.stderr)
        return 3

    data = resp.json()
    # Print a minimal helpful payload
    print(json.dumps({
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
        "token_type": data.get("token_type"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
