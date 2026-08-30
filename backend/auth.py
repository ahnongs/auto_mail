from fastapi import APIRouter, HTTPException, Cookie
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from .config import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI,
    SECRET_KEY, FRONTEND_URL, SCOPES,
)
from .storage import load_user, save_user
import httpx
import secrets

router = APIRouter()

# 프론트와 백엔드를 same-origin('/api' 프록시)으로 붙이므로 세션 쿠키는 1st-party 가 된다.
# 따라서 SameSite=Lax 로 충분하며, 서드파티 쿠키 차단(Safari ITP 등)에 영향받지 않아
# 모든 브라우저에서 동일하게 동작한다. https 일 때만 Secure 를 붙인다.
_IS_HTTPS        = FRONTEND_URL.startswith("https://")
_COOKIE_SAMESITE = "lax"
_COOKIE_SECURE   = _IS_HTTPS


def create_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )


def get_uid(session: str) -> str:
    try:
        return jwt.decode(session, SECRET_KEY, algorithms=["HS256"])["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")


def get_valid_credentials(uid: str) -> Credentials:
    """저장된 토큰 조회 후 만료 시 자동 갱신."""
    user_data = load_user(uid)
    access_token = user_data.get("access_token")
    refresh_token = user_data.get("refresh_token")
    token_expiry_str = user_data.get("token_expiry")

    if not access_token and not refresh_token:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다. 다시 로그인해주세요.")

    is_expired = True
    if access_token and token_expiry_str:
        try:
            expiry = datetime.fromisoformat(token_expiry_str)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            is_expired = expiry <= datetime.now(timezone.utc) + timedelta(minutes=5)
        except Exception:
            is_expired = True

    if not is_expired:
        return Credentials(token=access_token)

    if not refresh_token:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다. 다시 로그인해주세요.")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    creds.refresh(GoogleRequest())

    user_data["access_token"] = creds.token
    user_data["token_expiry"] = (
        creds.expiry.isoformat() if creds.expiry
        else (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    )
    save_user(uid, user_data)
    return creds


@router.get("/auth/google")
def google_login():
    # CSRF 방어: 임의 state 를 쿠키에 심고 콜백에서 대조한다.
    state = secrets.token_urlsafe(32)
    flow = create_flow()
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent", state=state)
    resp = RedirectResponse(auth_url)
    resp.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        samesite=_COOKIE_SAMESITE,
        secure=_COOKIE_SECURE,
        max_age=600,
    )
    return resp


@router.get("/auth/callback")
async def google_callback(code: str, state: str = "", oauth_state: str = Cookie(default=None)):
    # state 대조 (CSRF 방어)
    if not oauth_state or not state or not secrets.compare_digest(state, oauth_state):
        raise HTTPException(status_code=400, detail="잘못된 로그인 요청입니다. 다시 시도해주세요.")

    flow = create_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
        )
    user_info = resp.json()

    uid = user_info["id"]
    existing = load_user(uid)
    existing["access_token"] = credentials.token
    existing["token_expiry"] = (
        credentials.expiry.isoformat() if credentials.expiry
        else (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    )
    if credentials.refresh_token:
        existing["refresh_token"] = credentials.refresh_token
    save_user(uid, existing)

    token = jwt.encode(
        {
            "sub": user_info["id"],
            "email": user_info["email"],
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", ""),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    response = RedirectResponse(url=f"{FRONTEND_URL}?login=success")
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite=_COOKIE_SAMESITE,
        secure=_COOKIE_SECURE,
        max_age=60 * 60 * 24 * 30,
    )
    response.delete_cookie("oauth_state", samesite=_COOKIE_SAMESITE, secure=_COOKIE_SECURE)
    return response


@router.get("/auth/me")
def get_me(session: str = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        payload = jwt.decode(session, SECRET_KEY, algorithms=["HS256"])
        return {
            "email": payload["email"],
            "name": payload["name"],
            "picture": payload["picture"],
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")


@router.get("/auth/logout")
def logout():
    response = RedirectResponse(url=FRONTEND_URL)
    response.delete_cookie("session", samesite=_COOKIE_SAMESITE, secure=_COOKIE_SECURE)
    return response
