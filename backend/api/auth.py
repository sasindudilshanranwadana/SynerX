from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Dict, Any
import os
import requests


http_bearer = HTTPBearer(auto_error=True)


def _fetch_user_from_supabase(jwt: str) -> Dict[str, Any]:
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not supabase_url or not service_role_key:
        raise HTTPException(status_code=500, detail="Supabase not configured on server")

    # Use GoTrue user endpoint to validate token and fetch user
    auth_url = f"{supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {jwt}",
        "apikey": service_role_key,
    }
    try:
        resp = requests.get(auth_url, headers=headers, timeout=10)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Auth service unreachable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        return resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid auth response")


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(http_bearer)) -> Dict[str, Any]:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    jwt = creds.credentials
    return _fetch_user_from_supabase(jwt)


